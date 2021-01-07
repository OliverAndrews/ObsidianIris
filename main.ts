import { App, Modal, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile } from 'obsidian';

interface IIrisSettings {
	header: string;
	location: string,
}

const DEFAULT_SETTINGS: IIrisSettings = {
	header: '### Tasks',
	location: "Daily Notes"
}

export default class MyPlugin extends Plugin 
{
	settings: IIrisSettings;

	private _dailyNoteLocation: string;

	async updateFile(file: TAbstractFile) 
	{
		const heading = this.settings.header;
		if (file.path.includes(this._dailyNoteLocation)) {

			let documentTextPromise: Promise<string> = this.app.vault.read(this.app.workspace.getActiveFile());
			
			let filteredFilers = Array.from(this.app.vault.getFiles())
				.filter((entry) => entry.path.includes(this._dailyNoteLocation))
				.filter((entry) => entry.basename.localeCompare(file.name) != 0)
				.filter((entry) => (this.parseDate(entry.name) < this.parseDate(file.name)))


			let outcomes = filteredFilers
				.map((entry) => this.parseDate(file.name) - this.parseDate(entry.name));
			const preceeding = filteredFilers[outcomes.indexOf(Math.min(...outcomes))];

			if (!preceeding) return;

			const textPrevious = await this.app.vault.read(preceeding);
			let text: string = await documentTextPromise;

			text = text.replace(heading, `${heading}\n${this.findMatches(textPrevious)}`);
			await this.app.vault.modify(this.app.workspace.getActiveFile(), text);
		}
	}

	findMatches(text: string): string
	{
		const unfinishedTodosRegex = /- \[ \].*/g
		const listedText: Array<string> = Array.from(text.split("\n"));
		let taskLines: Array<string> = [];
		let hasSeenHeadder: boolean = false;

		for (let x of listedText) {
			if (x.includes("#")){
				if (x.includes(this.settings.header)){
					hasSeenHeadder = true;
					continue;
				} else if (!hasSeenHeadder) continue;
				break;
			}
			if (x.match(unfinishedTodosRegex)) taskLines.push(x);
		}
		return taskLines.join('\n')
	}

	async onload() 
	{
		this.addSettingTab(new IrisSettings(this.app, this));
		await this.loadSettings();

		this._dailyNoteLocation = this.settings.location;
		this.app.workspace.on("layout-ready", () => {
			this.app.vault.on("create", async (file) => {
				await this.updateFile(file);
			})
		});
	}

	parseDate(name: string) 
	{
		return (new Date(name.replace(".md", ""))).getTime()
	}

	async loadSettings() 
	{
		this.settings = Object.assign(DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() 
	{
		await this.saveData(this.settings);
	}
}

class IrisSettings extends PluginSettingTab {
	plugin: MyPlugin;
	private notes: string;
	private tasks: string;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.notes = "";
		this.tasks = "";
	}

	display(): void {
		let { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Settings for Iris' });

		new Setting(containerEl)
			.setName('To Do Headding')
			.setDesc('Enter the tag above your to-do list. (IE: ### To Do).')
			.addText(text => text
				.setPlaceholder('### To Do')
				.setValue(this.plugin.settings.header ? this.plugin.settings.header : DEFAULT_SETTINGS.header)
				.onChange(async (value) => {
					this.plugin.settings.header = value;
					this.tasks = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Daily Note Directory')
			.setDesc('Enter the directory you keep your Daily Notes in.')
			.addText(text => text
				.setPlaceholder('Daily Notes')
				.setValue(this.plugin.settings.location ? this.plugin.settings.location : DEFAULT_SETTINGS.location)
				.onChange(async (value) => {
					this.plugin.settings.location = value;
					this.notes = value;
					await this.plugin.saveSettings();
				}));

	}
}
