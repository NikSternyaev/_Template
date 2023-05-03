# Stable Node 19 version Based on Debian GNU/Linux 11 (bullseye)
FROM node:19

# Preparing Enviroment Variables
# Perform "export" to run on local machine
ENV credentials="./config/keys/credentials.json"
ENV postgresql="./config/postgresql.json"
ENV clickhouse="./config/clickhouse.json"
ENV setup="./config/setup.json"
ENV script_logs="./system/logs"
ENV script_data="./downloads"

# Preparing System
# Backing up repository sources
RUN cp /etc/apt/sources.list /etc/apt/sources.list.backup
# Changing repository souces
RUN echo "deb http://ftp.ru.debian.org/debian bullseye main" > /etc/apt/sources.list
RUN echo "deb http://ftp.ru.debian.org/debian bullseye-proposed-updates main contrib non-free" >> /etc/apt/sources.list
RUN echo "deb http://ftp.ru.debian.org/debian-security bullseye-security main" >> /etc/apt/sources.list
# Setting up repository for clickhouse-client
RUN apt-get install -y ca-certificates dirmngr
RUN GNUPGHOME=$(mktemp -d)
RUN GNUPGHOME="$GNUPGHOME" gpg --no-default-keyring --keyring /usr/share/keyrings/clickhouse-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 8919F6BD2B48D754
# RUN rm -r "$GNUPGHOME"
RUN chmod +r /usr/share/keyrings/clickhouse-keyring.gpg
RUN echo "deb [signed-by=/usr/share/keyrings/clickhouse-keyring.gpg] https://packages.clickhouse.com/deb stable main" | tee /etc/apt/sources.list.d/clickhouse.list
RUN apt-get update
# Install ClickHouse client
RUN apt-get install -y clickhouse-client
# Install cron
RUN apt-get install -y cron

# Preparing Project
# Installing dependencies
WORKDIR /
COPY package*.json ./
RUN npm ci
# Copying project files
COPY . .
# Creating working folders
RUN mkdir downloads
RUN mkdir -p system/logs

# Setting up cron
# Scheduling cron job
RUN echo "0 1 * * * npm start" | crontab -
RUN cron
# Starting cron
CMD npm start
# CMD node tests/test.js