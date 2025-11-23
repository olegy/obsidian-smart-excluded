import { App, debounce, Notice, PluginSettingTab, Setting } from "obsidian";
import SmartExcludedPlugin from "./main";

export class SmartExcludedSettingTab extends PluginSettingTab {
	public plugin: SmartExcludedPlugin;

	constructor(app: App, plugin: SmartExcludedPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	public display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const plugin = this.plugin.getWorkspacesPlugin();
		if (!plugin) {
			containerEl.createEl('div', { text: 'Core plugin [Workspaces] not found. Please ensure it is enabled.' });
			return;
		}

		// Add warning about override
		const warning = containerEl.createEl('div', { cls: 'workspace-exclude-warning' });
		warning.setText('⚠️ This plugin will override the core "Files and links" excluded files setting based on the conditions below.');

		const { workspaces } = plugin;

		// List all workspaces and provide per-workspace exclude configuration
		if (workspaces.length === 0) {
			containerEl.createEl('div', { text: 'No workspaces found.' });
			return;
		}

		const notify = debounce((workspace) => {
			new Notice(`${this.plugin.name}: Excluded files for workspace "${workspace}" updated.`);
		}, 1000, true)


		Object.keys(workspaces).forEach((workspace: string) => {
			new Setting(containerEl).setName(`Workspace: ${workspace}`).setHeading();
			new Setting(containerEl)
				.setName('Excluded files')
				.setDesc('This will override the core "Files and links" excluded files setting for this workspace.')
				.addTextArea(textarea => {
					const value = this.plugin.settings.workspaceExcludes?.[workspace]?.join('\n') || '';
					textarea
						.setPlaceholder('work\npersonal')
						.setValue(value)
						.onChange(async (val) => {
							if (!this.plugin.settings.workspaceExcludes) this.plugin.settings.workspaceExcludes = {};
							this.plugin.settings.workspaceExcludes[workspace] = val.split('\n').map(s => s.trim()).filter(Boolean);
							await this.plugin.saveSettings();
							notify(workspace)
						});
				});
		});

		new Setting(containerEl).setName('Status bar').setHeading();
		new Setting(containerEl)
			.setName('Show active workspace in status bar')
			.setDesc('This will show the active workspace in the status bar.')
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.showWorkspaceNameInStatusBar ?? false)
					.onChange(async (value) => {
						this.plugin.settings.showWorkspaceNameInStatusBar = value;
						await this.plugin.saveSettings();
						this.plugin.toggleStatusBarItem(value);
					});
			})

		// Add auto-save setting
		new Setting(containerEl).setName('Auto save').setHeading();
		new Setting(containerEl)
			.setName('Auto save workspace layout on change')
			.setDesc('Automatically save the current workspace layout whenever a change is made.')
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.saveOnChange ?? false)
					.onChange(async (value) => {
						this.plugin.settings.saveOnChange = value;
						await this.plugin.saveSettings();
					});
			})

		// Add focus on workspace folder setting
		containerEl.createEl('h2', { text: 'File Tree Alternative Integration' });

		new Setting(containerEl)
			.setName('Focus on workspace folder')
			.setDesc('When changing workspaces, automatically focus on the folder with the same name in the File Tree Alternative plugin. Requires the File Tree Alternative plugin to be installed and enabled.')
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.focusOnWorkspaceFolder ?? false)
					.onChange(async (value) => {
						this.plugin.settings.focusOnWorkspaceFolder = value;
						await this.plugin.saveSettings();
					});
			})
	}
}
