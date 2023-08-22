'use strict';

// This line should always be right on top.

if ((Reflect as any).metadata === undefined) {
    require('reflect-metadata');
}

// Initialize source maps (this must never be moved up nor further down).
import { initialize } from './sourceMapSupport';
initialize(require('vscode'));

//===============================================
// We start tracking the extension's startup time at this point.  The
// locations at which we record various Intervals are marked below in
// the same way as this.

const durations = {} as IStartupDurations;
import { StopWatch } from './common/utils/stopWatch';
// Do not move this line of code (used to measure extension load times).
const stopWatch = new StopWatch();

// Initialize file logging here. This should not depend on too many things.
import { initializeFileLogging, traceError } from './logging';
const logDispose: { dispose: () => void }[] = [];
initializeFileLogging(logDispose);

//===============================================
// loading starts here

import { ProgressLocation, ProgressOptions, window } from 'vscode';
import { buildApi } from './api';
import { IApplicationShell, IWorkspaceService } from './common/application/types';
import { IDisposableRegistry, IExperimentService, IExtensionContext } from './common/types';
import { createDeferred } from './common/utils/async';
import { Common } from './common/utils/localize';
import { activateComponents, activateFeatures } from './extensionActivation';
import { initializeStandard, initializeComponents, initializeGlobals } from './extensionInit';
import { IServiceContainer } from './ioc/types';
import { sendErrorTelemetry, sendStartupTelemetry } from './startupTelemetry';
import { IStartupDurations } from './types';
import { runAfterActivation } from './common/utils/runAfterActivation';
import { IInterpreterService } from './interpreter/contracts';
import { PythonExtension } from './api/types';
import { WorkspaceService } from './common/application/workspace';
import { disposeAll } from './common/utils/resourceLifecycle';
import { ProposedExtensionAPI } from './proposedApiTypes';
import { buildProposedApi } from './proposedApi';

// --- Start Positron ---

import * as positron from 'positron';
import { pythonRuntimeProvider } from './positron/provider';

// --- End Positron ---

durations.codeLoadingTime = stopWatch.elapsedTime;

//===============================================
// loading ends here

// These persist between activations:
let activatedServiceContainer: IServiceContainer | undefined;

/////////////////////////////
// public functions

export async function activate(context: IExtensionContext): Promise<PythonExtension> {
    let api: PythonExtension;
    let ready: Promise<void>;
    let serviceContainer: IServiceContainer;
    try {
        const workspaceService = new WorkspaceService();
        context.subscriptions.push(
            workspaceService.onDidGrantWorkspaceTrust(async () => {
                await deactivate();
                await activate(context);
            }),
        );
        [api, ready, serviceContainer] = await activateUnsafe(context, stopWatch, durations);
    } catch (ex) {
        // We want to completely handle the error
        // before notifying VS Code.
        await handleError(ex as Error, durations);
        throw ex; // re-raise
    }
    // Send the "success" telemetry only if activation did not fail.
    // Otherwise Telemetry is send via the error handler.

    // --- Start Positron ---

    // Wait for all extension components to be activated before starting Positron activation.
    // This is already awaited in sendStartupTelemetry before this function returns, so it shouldn't
    // affect any callers.
    await ready;

    // Map of interpreter path to language runtime metadata, used to determine the runtimeId when
    // switching the active interpreter path.
    const runtimes = new Map<string, positron.LanguageRuntimeMetadata>();

    // Register the Python language runtime provider with positron.
    positron.runtime.registerLanguageRuntimeProvider('python', pythonRuntimeProvider(serviceContainer, runtimes));

    // If the interpreter is changed via the Python extension, select the corresponding
    // language runtime in Positron.
    const disposables = serviceContainer.get<IDisposableRegistry>(IDisposableRegistry);
    disposables.push(
        api.environments.onDidChangeActiveEnvironmentPath(async (event) => {
            const runtime = runtimes.get(event.path);
            if (runtime) {
                positron.runtime.selectLanguageRuntime(runtime.runtimeId);
            } else {
                // TODO: This is currently thrown when you create a new venv and switch to it
                // after the extension has been activated (e.g. #1002). We should hook into
                // environment changes and register/unregister runtimes appropriately.
                throw Error(`Tried to switch to a language runtime that has not been registered: ${event.path}`);
            }
        }),
    );

    // --- End Positron ---

    sendStartupTelemetry(ready, durations, stopWatch, serviceContainer)
        // Run in the background.
        .ignoreErrors();
    return api;
}

export async function deactivate(): Promise<void> {
    // Make sure to shutdown anybody who needs it.
    if (activatedServiceContainer) {
        const disposables = activatedServiceContainer.get<IDisposableRegistry>(IDisposableRegistry);
        await disposeAll(disposables);
        // Remove everything that is already disposed.
        while (disposables.pop());
    }
}

/////////////////////////////
// activation helpers

async function activateUnsafe(
    context: IExtensionContext,
    startupStopWatch: StopWatch,
    startupDurations: IStartupDurations,
): Promise<[PythonExtension & ProposedExtensionAPI, Promise<void>, IServiceContainer]> {
    // Add anything that we got from initializing logs to dispose.
    context.subscriptions.push(...logDispose);

    const activationDeferred = createDeferred<void>();
    displayProgress(activationDeferred.promise);
    startupDurations.startActivateTime = startupStopWatch.elapsedTime;

    //===============================================
    // activation starts here

    // First we initialize.
    const ext = initializeGlobals(context);
    activatedServiceContainer = ext.legacyIOC.serviceContainer;
    // Note standard utils especially experiment and platform code are fundamental to the extension
    // and should be available before we activate anything else.Hence register them first.
    initializeStandard(ext);
    // We need to activate experiments before initializing components as objects are created or not created based on experiments.
    const experimentService = activatedServiceContainer.get<IExperimentService>(IExperimentService);
    // This guarantees that all experiment information has loaded & all telemetry will contain experiment info.
    await experimentService.activate();
    const components = await initializeComponents(ext);

    // Then we finish activating.
    const componentsActivated = await activateComponents(ext, components);
    activateFeatures(ext, components);

    const nonBlocking = componentsActivated.map((r) => r.fullyReady);
    const activationPromise = (async () => {
        await Promise.all(nonBlocking);
    })();

    //===============================================
    // activation ends here

    startupDurations.totalActivateTime = startupStopWatch.elapsedTime - startupDurations.startActivateTime;
    activationDeferred.resolve();

    setTimeout(async () => {
        if (activatedServiceContainer) {
            const workspaceService = activatedServiceContainer.get<IWorkspaceService>(IWorkspaceService);
            if (workspaceService.isTrusted) {
                const interpreterManager = activatedServiceContainer.get<IInterpreterService>(IInterpreterService);
                const workspaces = workspaceService.workspaceFolders ?? [];
                await interpreterManager
                    .refresh(workspaces.length > 0 ? workspaces[0].uri : undefined)
                    .catch((ex) => traceError('Python Extension: interpreterManager.refresh', ex));
            }
        }

        runAfterActivation();
    });

    const api = buildApi(
        activationPromise,
        ext.legacyIOC.serviceManager,
        ext.legacyIOC.serviceContainer,
        components.pythonEnvs,
    );
    const proposedApi = buildProposedApi(components.pythonEnvs, ext.legacyIOC.serviceContainer);
    return [{ ...api, ...proposedApi }, activationPromise, ext.legacyIOC.serviceContainer];
}

function displayProgress(promise: Promise<any>) {
    const progressOptions: ProgressOptions = { location: ProgressLocation.Window, title: Common.loadingExtension };
    window.withProgress(progressOptions, () => promise);
}

/////////////////////////////
// error handling

async function handleError(ex: Error, startupDurations: IStartupDurations) {
    notifyUser(
        "Extension activation failed, run the 'Developer: Toggle Developer Tools' command for more information.",
    );
    traceError('extension activation failed', ex);

    await sendErrorTelemetry(ex, startupDurations, activatedServiceContainer);
}

interface IAppShell {
    showErrorMessage(string: string): Promise<void>;
}

function notifyUser(msg: string) {
    try {
        let appShell: IAppShell = (window as any) as IAppShell;
        if (activatedServiceContainer) {
            appShell = (activatedServiceContainer.get<IApplicationShell>(IApplicationShell) as any) as IAppShell;
        }
        appShell.showErrorMessage(msg).ignoreErrors();
    } catch (ex) {
        traceError('Failed to Notify User', ex);
    }
}
