import argparse
import json
import os
import re
from pathlib import Path


TOKEN = re.compile(r"\$\{([A-Z][A-Z0-9_]*)\}")
INTEGER_SETTINGS = {"MC_PG_PORT", "BTC_RPC_PORT", "LTC_RPC_PORT"}


def expand(value):
    if isinstance(value, dict):
        return {key: expand(item) for key, item in value.items()}
    if isinstance(value, list):
        return [expand(item) for item in value]
    if isinstance(value, str):
        match = TOKEN.fullmatch(value)
        if match:
            name = match.group(1)
            raw = os.environ[name]
            return int(raw) if name in INTEGER_SETTINGS else raw
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--template", default="/app/config.template.json")
    parser.add_argument("--output", default="/app/config.json")
    args = parser.parse_args()

    config = expand(json.loads(Path(args.template).read_text()))
    output = Path(args.output)
    output.write_text(json.dumps(config, indent=2))
    output.chmod(0o600)


if __name__ == "__main__":
    main()