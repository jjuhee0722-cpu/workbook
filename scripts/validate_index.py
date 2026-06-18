#!/usr/bin/env python3
"""Validate the workbook GitHub Pages entrypoint before deployment."""

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SOURCE = ROOT / "src" / "index.html"
BUILD_SCRIPT = ROOT / "scripts" / "build.mjs"
PACKAGE = ROOT / "package.json"


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    if not INDEX.exists():
        fail("index.html is missing")
    if not SOURCE.exists():
        fail("src/index.html is missing")
    if not BUILD_SCRIPT.exists() or not PACKAGE.exists():
        fail("The reproducible build files are missing")

    html = INDEX.read_text(encoding="utf-8")
    source = SOURCE.read_text(encoding="utf-8")
    checks = [
        ('type="text/babel"', "Do not deploy JSX that must be compiled in the browser."),
        ("type='text/babel'", "Do not deploy JSX that must be compiled in the browser."),
        ("@babel/standalone", "Do not depend on Babel Standalone in production."),
        ("babel.min.js", "Do not load Babel in the live page."),
    ]
    for needle, message in checks:
        if needle in html:
            fail(f"{message} Found {needle!r}.")

    if "ReactDOM.createRoot" not in html:
        fail("React root initialization was not found.")

    if "React.createElement" not in html:
        fail("index.html does not look precompiled. Expected React.createElement output.")

    if '<div id="root"></div>' not in html:
        fail("The #root mount node is missing or changed.")

    if len(html) < 20_000:
        fail("index.html is unexpectedly small; verify the app content was not truncated.")

    if 'type="text/babel"' not in source:
        fail("src/index.html must remain the editable JSX source")

    if "scripts/build.mjs" not in PACKAGE.read_text(encoding="utf-8"):
        fail("package.json does not point to the build script")

    print("OK: source/build structure is complete and index.html is ready for GitHub Pages.")


if __name__ == "__main__":
    main()
