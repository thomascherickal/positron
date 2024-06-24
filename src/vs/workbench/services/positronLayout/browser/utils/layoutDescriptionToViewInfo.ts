/*---------------------------------------------------------------------------------------------
 *  Copyright (C) 2024 Posit Software, PBC. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { CustomPositronLayoutDescription, KnownPositronLayoutParts } from 'vs/workbench/services/positronLayout/common/positronCustomViews';
import { ViewContainerLocation } from 'vs/workbench/common/views';
import { Parts } from 'vs/workbench/services/layout/browser/layoutService';


const partToViewContainerLocation: Record<KnownPositronLayoutParts, ViewContainerLocation> = {
	[Parts.PANEL_PART]: ViewContainerLocation.Panel,
	[Parts.SIDEBAR_PART]: ViewContainerLocation.Sidebar,
	[Parts.AUXILIARYBAR_PART]: ViewContainerLocation.AuxiliaryBar,
};

/**
 * Internal format for the ViewDescriptorService's view info, bundled into a single object for
 * easier handling.
 */
type ViewDescriptionInfo = {
	viewContainerLocations: Map<string, ViewContainerLocation>;
	viewDescriptorCustomizations: Map<string, string>;
};

/**
 * Convert our custom layout description to the `IViewsCustomizations` format that the
 * `viewDescriptorService` uses for its internal state.
 * @param layout Positron custom layout description
 * @returns Simplified view info in the form of viewContainerLocations and
 * viewDescriptorCustomizations. See `IViewsCustomizations` for more info.
 */
export function layoutDescriptionToViewInfo(layout: CustomPositronLayoutDescription): ViewDescriptionInfo {
	const viewContainerLocations = new Map<string, ViewContainerLocation>();
	const viewDescriptorCustomizations = new Map<string, string>();

	for (const [part, info] of Object.entries(layout)) {
		const viewContainers = info.viewContainers;
		if (!viewContainers) { continue; }
		const viewContainerLocation = partToViewContainerLocation[part as KnownPositronLayoutParts];

		for (const viewContainer of viewContainers) {
			viewContainerLocations.set(viewContainer.id, viewContainerLocation);

			if (!viewContainer.views) { continue; }
			for (const view of viewContainer.views) {
				viewDescriptorCustomizations.set(view.id, viewContainer.id);
			}
		}
	}

	return {
		viewContainerLocations,
		viewDescriptorCustomizations,
	};
}
