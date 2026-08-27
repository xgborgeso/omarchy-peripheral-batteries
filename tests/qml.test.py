#!/usr/bin/env python3
"""Structural guards on the QML sources.

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
QML_FILES = sorted(ROOT.glob("*.qml"))

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


class QmlDeclarationTests(unittest.TestCase):
    """Mistakes that load fine in a text editor and fail in the shell.

    Quickshell rejects the whole component when a declaration is malformed, and
    the only symptom the user sees is the widget missing from the bar with a
    "Target not found" line on the shell's console. qmlformat parses these
    happily and qmllint does not flag them, so they are checked here.
    """

    # QML property names must start lowercase; an uppercase one is read as a
    # type annotation and the component fails to register.
    DECLARATION = re.compile(
        r"^\s*(?:readonly\s+|required\s+|default\s+)*property\s+[\w.<>]+\s+([A-Za-z_]\w*)"
    )

    def test_property_names_start_lowercase(self):
        offenders = []
        for path in QML_FILES:
            for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                match = self.DECLARATION.match(line)
                if match and not match.group(1)[0].islower():
                    offenders.append("%s:%d %s" % (path.name, number, match.group(1)))
        self.assertEqual(
            offenders,
            [],
            "QML property names must start lowercase or the component will not "
            "register and the widget silently vanishes from the bar: "
            + ", ".join(offenders),
        )

    def test_it_inspects_every_qml_file(self):
        names = [p.name for p in QML_FILES]
        self.assertIn("Panel.qml", names)
        self.assertIn("Service.qml", names)


if __name__ == "__main__":
    unittest.main()
