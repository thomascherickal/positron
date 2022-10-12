#!/usr/bin/env sh

cat <<- EOF
This script will:

- Kill any running build daemons,
- Recursively remove any existing 'node_modules' folders,
- Rebuild the aforementioned 'node_modules' folders,
- Re-compile the existing Typescript source.

This will probably take a while, so only run this script
if you're stuck and you need to restart from a fresh slate.

EOF
read -p 'Do you want to proceed? [y/N]: ' proceed

case "${proceed}" in
	[yY]*)	;;
	*)
		echo "Operation aborted."
		exit 0
	;;
esac

# Kill any running deemons.
yarn run kill-watchd
yarn run kill-watch-webd
yarn run kill-watch-clientd
yarn run kill-watch-extensionsd
yarn run kill-watch-build-toolsd

# Remove any existing node_modules folders.
find . -name 'node_modules' -exec rm -rf {} +

# Run yarn to rebuild 'node_modules'.
yarn

# Run a single compile to make sure the generated JavaScript is up-to-date.
yarn run compile

