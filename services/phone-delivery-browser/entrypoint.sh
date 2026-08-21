#!/bin/sh
set -eu

screen="${PHONE_DELIVERY_SCREEN:-1280x1024x24}"
vnc_password="${PHONE_DELIVERY_VNC_PASSWORD:-}"
if [ "${#vnc_password}" -lt 8 ]; then
  echo "PHONE_DELIVERY_VNC_PASSWORD must contain at least 8 characters" >&2
  exit 1
fi

mkdir -p "${PHONE_DELIVERY_PROFILE:-/data/profile}" /root/.vnc
Xvfb "${DISPLAY:-:99}" -screen 0 "$screen" -ac +extension GLX +render -noreset >/tmp/phone-delivery-xvfb.log 2>&1 &
display_number="${DISPLAY:-:99}"
display_number="${display_number#:}"
ready=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if [ -S "/tmp/.X11-unix/X${display_number}" ]; then ready=1; break; fi
  sleep 0.25
done
if [ "$ready" -ne 1 ]; then cat /tmp/phone-delivery-xvfb.log >&2; exit 1; fi
x11vnc -storepasswd "$vnc_password" /root/.vnc/passwd >/dev/null
x11vnc -display "${DISPLAY:-:99}" -rfbauth /root/.vnc/passwd -forever -shared -bg -rfbport 5900 >/tmp/phone-delivery-vnc.log 2>&1
websockify --web=/usr/share/novnc/ 6080 localhost:5900 >/tmp/phone-delivery-novnc.log 2>&1 &

exec node src/server.mjs
