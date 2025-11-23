import { Notice, Plugin, TFolder } from 'obsidian';
import { WorkspacesPluginInstance } from 'obsidian-typings';
import { SmartExcludedSettingTab } from './SmartExcludedSettingTab';

interface SmartExcludedSettings {
	workspaceExcludes: Record<string, (string | RegExp)[]>;
	showWorkspaceNameInStatusBar?: boolean;
	saveOnChange?: boolean;
	focusOnWorkspaceFolder?: boolean;
}

const DEFAULT_SETTINGS: SmartExcludedSettings = {
	workspaceExcludes: {},
	saveOnChange: false,
	focusOnWorkspaceFolder: false
}

export default class SmartExcludedPlugin extends Plugin {
	public settings: SmartExcludedSettings;


	private __previousActiveWorkspace: string | null = null;

	private __statusBarItemEl: HTMLElement;

	public async onload() {
		await this.loadSettings();

		this.__statusBarItemEl = this.addStatusBarItem();

		this.addSettingTab(new SmartExcludedSettingTab(this.app, this));
		// There is no exposed event for workspace change, so we use layout-change as a workaround
		this.registerEvent(this.app.workspace.on('layout-change', () => {
			const currentActiveWorkspace = this.getWorkspacesPlugin()?.activeWorkspace;

			// Auto-save workspace layout if the option is enabled (this should happen on all layout changes)
			if (this.settings.saveOnChange && currentActiveWorkspace) {
				const workspacesPlugin = this.app.internalPlugins.getEnabledPluginById('workspaces');
				if (workspacesPlugin) {
					workspacesPlugin.saveWorkspace(currentActiveWorkspace);
				}
			}

			const activeWorkspaceChanged = currentActiveWorkspace !== this.__previousActiveWorkspace;
			if (!activeWorkspaceChanged) return;
			this.setUserIgnoredFiltersByWorkspace(this.getWorkspacesPlugin()?.activeWorkspace);
			if (this.settings.focusOnWorkspaceFolder) {
				this.focusOnWorkspaceFolder(currentActiveWorkspace);
			}
			this.__previousActiveWorkspace = currentActiveWorkspace ?? null;
			this.__statusBarItemEl?.setText(this.getWorkspacesPlugin()?.activeWorkspace ?? 'Workspace not set');
		}))

		this.addCommand({
			id: 'smart-excluded-disable',
			name: `${this.name}: Clear excluded files setting temporarily`,
			callback: () => {
				this.setUserIgnoredFiltersByWorkspace('')
			}
		})

		this.toggleStatusBarItem(this.settings.showWorkspaceNameInStatusBar ?? false);
	}
	public get name() {
		return 'Smart excluded'
	}

	public toggleStatusBarItem(force?: boolean) {
		if (!this.__statusBarItemEl) return;
		const cls = 'smart-excluded-statusbar--hidden'
		const hidden = this.__statusBarItemEl.classList.contains(cls)
		this.__statusBarItemEl.classList.toggle(cls, force === undefined ? !hidden : !force);
	}

	public onunload() {
	}

	public async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	public async saveSettings() {
		await this.saveData(this.settings);
	}

	public getWorkspacesPlugin(): WorkspacesPluginInstance | null {
		const workspacesPlugin = this.app.internalPlugins.getEnabledPluginById('workspaces');
		if (!workspacesPlugin) {
			new Notice('Core plugin "Workspaces" not found. Please ensure it is enabled.');
			return null;
		}
		return workspacesPlugin
	}

	public setUserIgnoredFiltersByWorkspace(workspaceName?: string) {
		const plugin = this.getWorkspacesPlugin();
		if (!plugin) return;
		const workspace = workspaceName ?? plugin.activeWorkspace;
		const excludes = this.settings.workspaceExcludes[workspace] ?? [];
		// Excluded files setting
		this.app.vault.setConfig('userIgnoreFilters', excludes)
		new Notice(`${this.name}: Excluded files set for "${workspace}"`);
	}

	/**
	 * Focuses on the folder that matches the workspace name in the file-tree-alternative plugin
	 */
	public focusOnWorkspaceFolder(workspaceName?: string) {
		if (!workspaceName) return;

		// Get the file-tree-alternative plugin
		const fileTreePlugin = this.app.plugins.getPlugin('file-tree-alternative');
		if (!fileTreePlugin) {
			new Notice('File Tree Alternative plugin not found. Focus on workspace folder feature requires file-tree-alternative plugin to be installed and enabled.');
			return;
		}

		// Type guard to check if required properties exist
		const typedPlugin: any = fileTreePlugin;
		if (!typedPlugin.keys || !typedPlugin.refreshTreeLeafs) {
			new Notice('File Tree Alternative plugin does not have expected API. Focus on workspace folder feature requires a compatible version.');
			return;
		}

		// Find a top-level folder with the same name as the workspace
		const rootChildren = this.app.vault.getRoot().children;
		for (const child of rootChildren) {
			if (child.name === workspaceName && child instanceof TFolder) {
				// Found matching folder - activate it in the file-tree-alternative plugin
				try {
					// Set the focused folder in localStorage
					localStorage.setItem(typedPlugin.keys.focusedFolder, child.path);

					// Refresh the tree view to apply the change
					typedPlugin.refreshTreeLeafs();

					new Notice(`Focused on "${workspaceName}" folder`);
				} catch (error) {
					console.error('Error focusing on workspace folder:', error);
				}
				return; // Stop after first match
			}
		}

		// If no matching folder found, do nothing and leave the current focus state as is
	}

}
