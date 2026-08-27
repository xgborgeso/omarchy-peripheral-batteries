#!/usr/bin/env python3
"""Structural guards on Panel.qml.

These do not run QML; they read the file. The point is to catch a regression of
the marketplace security review finding (a Text sink left on Text.AutoText,
where a peripheral-supplied product name would be interpreted as markup) in a
way that does not need a compositor, a shell, or a display.
"""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PANEL = ROOT / "Panel.qml"

# Types that render `text` and therefore honour textFormat. Ui.PanelSectionHeader
# subclasses Text, so it inherits Text.AutoText and needs pinning just the same --
# that is the one the original review caught.
TEXT_TYPES = ("Text", "Ui.PanelSectionHeader")

OPEN = re.compile(r"^\s*(?:[A-Za-z_][\w.]*\s*:\s*)?([A-Za-z_][\w.]*)\s*\{\s*$")


def text_blocks(source: str):
    """Yield (type_name, line_number, body) for every text-rendering block."""
    lines = source.splitlines()
    for index, line in enumerate(lines):
        match = OPEN.match(line)
        if not match or match.group(1) not in TEXT_TYPES:
            continue
        depth = 0
        body = []
        for follow in lines[index:]:
            depth += follow.count("{") - follow.count("}")
            body.append(follow)
            if depth == 0:
                break
        yield match.group(1), index + 1, "\n".join(body)


class PanelTextSafetyTests(unittest.TestCase):
    def setUp(self):
        self.source = PANEL.read_text(encoding="utf-8")
        self.blocks = list(text_blocks(self.source))

    def test_the_parser_actually_finds_the_blocks(self):
        # A guard that silently matches nothing would pass forever.
        self.assertGreaterEqual(len(self.blocks), 7, self.blocks)
        self.assertIn("Ui.PanelSectionHeader", [b[0] for b in self.blocks])

    def test_every_text_sink_is_pinned_to_plain_text(self):
        unpinned = [
            "%s at %s:%d" % (kind, PANEL.name, line)
            for kind, line, body in self.blocks
            if "textFormat: Text.PlainText" not in body
        ]
        self.assertEqual(
            unpinned,
            [],
            "These render peripheral-supplied text without Text.PlainText, so a "
            "hostile product name could be interpreted as markup: "
            + ", ".join(unpinned),
        )

    def test_no_sink_opts_into_rich_text(self):
        for bad in ("Text.RichText", "Text.StyledText", "Text.AutoText"):
            self.assertNotIn(bad, self.source)


if __name__ == "__main__":
    unittest.main()
