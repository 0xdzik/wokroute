#!/bin/sh
set -eu

# Railway mounts persistent volumes after the image filesystem is created, so
# the mount can be root-owned even though the image data directory is not.
# Repair ownership before dropping privileges to the application user.
mkdir -p /app/data /app/data/warp /app/bin
chown -R wokroute:wokroute /app/data /app/bin

exec su-exec wokroute "$@"
