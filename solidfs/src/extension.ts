// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { QueryEngine } from '@comunica/query-sparql-solid';
import * as vscode from 'vscode';

// TODO: Investigate https://stackoverflow.com/questions/61959354/vscode-extension-add-custom-command-to-right-click-menu-in-file-explorer


const LinkHeader = require('http-link-header')
// TODO: 
// TODO: Just use the WebID data once https://github.com/CommunitySolidServer/CommunitySolidServer/issues/1484 is closed
export async function getPodRoot(url: string, fetch: Function): Promise<string | null> {
	let splitUrl = url.split('/')
	for (let index = splitUrl.length - 1; index > 2; --index) {
		let currentUrl = splitUrl.slice(0, index).join('/') + '/'
		let res = await fetch(currentUrl)
		if (!res.ok) throw new Error(`HTTP Error Response requesting ${url}: ${res.status} ${res.statusText}`);
		let linkHeaders = res.headers.get('Link')
		if (!linkHeaders) return null;
		let headers = LinkHeader.parse(linkHeaders)
		for (let header of headers.refs) {
			if (header.uri === 'http://www.w3.org/ns/pim/space#Storage' && header.rel === 'type') {
				return currentUrl.endsWith('/') ? currentUrl : currentUrl + '/';
			}
		}
	}
	return null;
}

function getFetch(session: vscode.AuthenticationSession): typeof globalThis.fetch {
	const { fetch } = session.account as any;
	if (typeof fetch !== 'function') {
		throw new Error('Expected fetch to be a function');
	}
	return fetch;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const engine = new QueryEngine();

	// TODO: Potentially use scopes to indicate the webId that we want to log in with
	vscode.authentication.getSession('solidauth', [], { createIfNone: false });

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "solidfs" is now active!');
	const data = context.workspaceState.get<{ [key: string]: string[] }>('solidfs');
	console.log('extension is active with the data', data)
	// const state = data && JSON.parse(data)

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('solidfs.helloWorld', async () => {
		const session = await vscode.authentication.getSession('solidauth', [], { createIfNone: true });
		console.log('created session', session)

		const fetch = getFetch(session);
		const webId = session.account.id;

		const root = await getPodRoot(webId, fetch);
		let roots = root ? [root] : [];

		if (roots.length === 0) {
			const bindings = await engine.queryBindings(
				`SELECT DISTINCT * WHERE { <${webId}> <http://www.w3.org/ns/pim/space#storage> ?o }`, {
				sources: [webId]
			});

			roots = await bindings.map(binding => binding.get('o')?.value ?? null).toArray();
		}

		// console.log('the loaded roots are', roots)
		await context.workspaceState.update(`solidfs`, { [webId]: roots })

		vscode.window.showInformationMessage(`Welcome from solidFS ${session.account.label}`);

		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		// vscode.window.showInformationMessage('Hello World from solidFS!');
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
