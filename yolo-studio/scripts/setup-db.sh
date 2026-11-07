#!/usr/bin/env bash
# Creates the yolo_studio database and user, then writes api/.env.
# Admin login: `mysql -u root -p` (asks the MySQL root password).
# Other admin: MYSQL_ADMIN="mysql -u admin -p" ./scripts/setup-db.sh  (or MYSQL_ADMIN="sudo mysql" for socket auth)
set -euo pipefail
cd "$(dirname "$0")/.."
ENV=api/.env
[ -f "$ENV" ] || cp api/.env.example "$ENV"
PASS=$(grep -E '^DB_PASSWORD=' "$ENV" | cut -d= -f2-)
if [ -z "$PASS" ]; then
  # mixed case, digits and a symbol: passes MySQL validate_password (MEDIUM/STRONG)
  PASS="Ys$(openssl rand -hex 14)_Q7"
  sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$PASS/" "$ENV"
fi
SQL=$(sed "s/__PASSWORD__/$PASS/g" api/sql/00_setup_as_admin.sql)
ADMIN=${MYSQL_ADMIN:-mysql -u root -p}
echo "Вход в MySQL: $ADMIN"
$ADMIN -e "$SQL"
echo "OK: database yolo_studio and user yolo_studio are ready; password is in $ENV"
