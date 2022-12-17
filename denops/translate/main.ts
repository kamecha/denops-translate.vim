import {
  Denops,
  ensureNumber,
  ensureObject,
  ensureString,
  GTR,
  mapping,
  Mode,
} from "./deps.ts";
import { buildOption, Position } from "./helper.ts";
import * as deepl from "./deepl.ts";

export async function main(denops: Denops): Promise<void> {
  const gtr = new GTR();

  const maps = [
    {
      lhs: "<silent> <Plug>(Translate)",
      rhs: ":Translate<CR>",
      mode: ["n", "v"],
    },
  ];

  for (const map of maps) {
    await mapping.map(denops, map.lhs, map.rhs, {
      mode: map.mode as Mode[],
    });
  }

  denops.dispatcher = {
    async translate(
      bang: unknown,
      startPos: unknown,
      endPos: unknown,
      visualModeType: unknown,
      arg: unknown,
    ): Promise<string[]> {
      ensureString(bang);

      const opt = await buildOption(
        denops,
        bang === "!",
	ensureObject(startPos) as Position,
	ensureObject(endPos) as Position,
	ensureString(visualModeType),
        arg ? (arg as string) : "",
      );

      if (opt.isDeepL) {
        return deepl.translate(opt);
      }

      const { trans } = await gtr.translate(opt.text, {
        sourceLang: opt.source,
        targetLang: opt.target,
      });

      return trans.split("\n");
    },
  };
}
