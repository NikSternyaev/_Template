# Описание проекта

Mappings:

Logs > ./system/logs/
Errors > ./system/errors.log
Console Output > ./system/console.log
Data Files > ./downloads/
Aplication credentials > ./config/keys/credentials.json 
Passwords and secrets > ./.env
Bind folder > ./docker-compose.yml

TODO:
1. Create .env file and set its content
2. Copy credentials.json to /config/keys/
3. Specify local logs folder at docker-compose.yml (format host_folder:container_folder)
