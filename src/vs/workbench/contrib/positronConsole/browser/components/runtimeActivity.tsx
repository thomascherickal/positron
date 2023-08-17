/*---------------------------------------------------------------------------------------------
 *  Copyright (C) 2023 Posit Software, PBC. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./runtimeActivity';
import * as React from 'react';
import { FontInfo } from 'vs/editor/common/config/fontInfo';
import { ActivityInput } from 'vs/workbench/contrib/positronConsole/browser/components/activityInput';
import { ActivityPrompt } from 'vs/workbench/contrib/positronConsole/browser/components/activityPrompt';
import { ActivityItemInput } from 'vs/workbench/services/positronConsole/common/classes/activityItemInput';
import { ActivityItemPrompt } from 'vs/workbench/services/positronConsole/common/classes/activityItemPrompt';
import { RuntimeItemActivity } from 'vs/workbench/services/positronConsole/common/classes/runtimeItemActivity';
import { ActivityOutputPlot } from 'vs/workbench/contrib/positronConsole/browser/components/activityOutputPlot';
import { ActivityErrorStream } from 'vs/workbench/contrib/positronConsole/browser/components/activityErrorStream';
import { ActivityOutputStream } from 'vs/workbench/contrib/positronConsole/browser/components/activityOutputStream';
import { ActivityErrorMessage } from 'vs/workbench/contrib/positronConsole/browser/components/activityErrorMessage';
import { ActivityItemOutputPlot } from 'vs/workbench/services/positronConsole/common/classes/activityItemOutputPlot';
import { ActivityOutputMessage } from 'vs/workbench/contrib/positronConsole/browser/components/activityOutputMessage';
import { ActivityItemErrorStream } from 'vs/workbench/services/positronConsole/common/classes/activityItemErrorStream';
import { ActivityItemOutputStream } from 'vs/workbench/services/positronConsole/common/classes/activityItemOutputStream';
import { ActivityItemErrorMessage } from 'vs/workbench/services/positronConsole/common/classes/activityItemErrorMessage';
import { IPositronConsoleInstance } from 'vs/workbench/services/positronConsole/common/interfaces/positronConsoleService';
import { ActivityItemOutputMessage } from 'vs/workbench/services/positronConsole/common/classes/activityItemOutputMessage';
import { ActivityItemOutputHtml } from 'vs/workbench/services/positronConsole/common/classes/activityItemOutputHtml';
import { ActivityOutputHtml } from 'vs/workbench/contrib/positronConsole/browser/components/activityOutputHtml';

// RuntimeActivityProps interface.
export interface RuntimeActivityProps {
	fontInfo: FontInfo;
	runtimeItemActivity: RuntimeItemActivity;
	positronConsoleInstance: IPositronConsoleInstance;
}

/**
 * RuntimeActivity component.
 * @param props A RuntimeActivityProps that contains the component properties.
 * @returns The rendered component.
 */
export const RuntimeActivity = (props: RuntimeActivityProps) => {
	// Render.
	return (
		<div className='runtime-activity'>
			{props.runtimeItemActivity.activityItems.map(activityItem => {
				if (activityItem instanceof ActivityItemInput) {
					return <ActivityInput key={activityItem.id} fontInfo={props.fontInfo} activityItemInput={activityItem} />;
				} else if (activityItem instanceof ActivityItemOutputStream) {
					return <ActivityOutputStream key={activityItem.id} activityItemOutputStream={activityItem} />;
				} else if (activityItem instanceof ActivityItemErrorStream) {
					return <ActivityErrorStream key={activityItem.id} activityItemErrorStream={activityItem} />;
				} else if (activityItem instanceof ActivityItemPrompt) {
					return <ActivityPrompt key={activityItem.id} activityItemPrompt={activityItem} positronConsoleInstance={props.positronConsoleInstance} />;
				} else if (activityItem instanceof ActivityItemOutputHtml) {
					return <ActivityOutputHtml key={activityItem.id} activityItemOutputHtml={activityItem} />;
				} else if (activityItem instanceof ActivityItemOutputMessage) {
					return <ActivityOutputMessage key={activityItem.id} activityItemOutputMessage={activityItem} />;
				} else if (activityItem instanceof ActivityItemOutputPlot) {
					return <ActivityOutputPlot key={activityItem.id} activityItemOutputPlot={activityItem} />;
				} else if (activityItem instanceof ActivityItemErrorMessage) {
					return <ActivityErrorMessage key={activityItem.id} activityItemErrorMessage={activityItem} />;
				} else {
					// This indicates a bug.
					return null;
				}
			})}
		</div>
	);
};
