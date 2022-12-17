import { Denops, ensureString, path, vars, xdg } from "./deps.ts";

export const deeplAuthokeyPath = path.join(
	xdg.config(),
	"denops_translate",
	"deepl_authkey",
);

export const onece = <A extends unknown, R extends Promise<unknown>>(
	f: (arg?: A) => R,
) => {
	let v: R | undefined;
	return (arg?: A): R => {
		return v || (v = f(arg));
	};
};

export async function readDeepLAuthkey(): Promise<string> {
	try {
		const text = await Deno.readTextFile(deeplAuthokeyPath);
		return text.trim();
	} catch (e) {
		throw new Error(
			`Cannot read DeepL's authkey from ${deeplAuthokeyPath}: ${e.message}`,
		);
	}
}

export const getDeepLAuthKey = onece(readDeepLAuthkey);

export type Option = {
	endpoint: string;
	isDeepL: boolean;
	authKey?: string;
	source: string;
	target: string;
	text: string;
};

export type Position = {
	lnum: number;
	col: number;
};

export async function buildOption(
	denops: Denops,
	bang: boolean,
	startPos: Position,
	endPos: Position,
	visualModeType: string,
	arg: string,
): Promise<Option> {
	const parts: string[] = [];

	let i = 0;
	const max = arg.length;
	let word = "";
	let skipWhitespace = false;

	while (i < max) {
		const char = arg[i];
		if (char === '"') {
			skipWhitespace = !skipWhitespace;
			i++;
			if (i < max && arg[i] === " ") {
				word += arg[i];
				i++;
			}
			continue;
		}
		if (!skipWhitespace && char === " ") {
			parts.push(word);
			word = "";
		} else {
			word += char;
		}
		i++;
	}

	if (word !== "") {
		parts.push(word);
	}

	const message: string[] = [];

	switch (parts.length) {
		case 1:
			ensureString(parts[0]);
			message.push(parts[0]);
			break;
		case 2:
		case 0:
			switch (visualModeType) {
				case "v":
					for (const [index, m] of ((await denops.call("getline", startPos.lnum, endPos.lnum)) as string[]).entries()) {
						let editedMessage = m;
						if (startPos.lnum === endPos.lnum) {
							editedMessage = editedMessage.substring(startPos.col, endPos.col);
						} else {
							if (index === 0) {
								editedMessage = editedMessage.substring(startPos.col);
							} else if (startPos.lnum + index === endPos.lnum) {
								editedMessage = editedMessage.substring(0, endPos.col);
							}
						}
						message.push(editedMessage);
					}
					break;
				case "V":
					for (const m of ((await denops.call("getline", startPos.lnum, endPos.lnum)) as string[])) {
						message.push(m);
					}
					break;
				case "^V":
					for (const m of ((await denops.call("getline", startPos.lnum, endPos.lnum)) as string[])) {
						let editedMessage = m.substring(startPos.col, endPos.col);
						message.push(editedMessage);
					}
					break;
			}
			break;
		default: {
			message.push(parts[2]);
		}
	}

	const source = await vars.g.get<string>(denops, "translate_source", "en");
	const target = await vars.g.get<string>(denops, "translate_target", "ja");
	const endpoint = await vars.g.get<string>(denops, "translate_endpoint", "");

	const opt = {
		endpoint: endpoint,
		isDeepL: endpoint.includes("deepl.com"),
		source: source,
		target: target,
		text: message.join("\n"),
	} as Option;

	if (parts.length >= 2) {
		opt.source = parts[0];
		opt.target = parts[1];
	}

	if (bang) {
		[opt.source, opt.target] = [opt.target, opt.source];
	}

	if (opt.isDeepL) {
		opt.authKey = await getDeepLAuthKey();
	}

	return opt;
}
