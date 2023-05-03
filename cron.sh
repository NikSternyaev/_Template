# !! запускать функции только через curl
# curl с заголовками
# https://stackoverflow.com/questions/356705/how-to-send-a-header-using-a-http-request-through-a-curl-call
# перенести в действующее расписание
# cat cron.sh | crontab -

# ORIGIN="http://localhost:8088"
# RUN cron.sh --prod    in production!
# if [[ $* == *--prod* ]]; then
#   # TODO: set production link here!
#   ORIGIN="http://localhost:8088"
# fi

# Запускать прокси после каждой перезагрузки сервера
@reboot nohup /home/dev/go/bin/chproxy -config /home/dev/chproxy/config.yml &

# Ad Platforms
10 0 * * * curl "https://dev.platina.sbermarketing.ru/functions/update/vkontakte/resources" # Обновление всех сущностей старого кабинета ВКонтакте
20 0 * * * curl "https://dev.platina.sbermarketing.ru/functions/update/yandex/direct/resources" # Обновление всех сущностей Яндекс Директа
50 0 * * * curl "https://dev.platina.sbermarketing.ru/functions/update/yandex/direct/parsefiles" # Разгребает не обработанные файлы в папке /downloads/yandex_direct_reports
0 1 * * * curl "https://dev.platina.sbermarketing.ru/functions/update/yandex/direct/statistics" # Обновление статистики Яндекс Директа
0 6 * * * curl "https://dev.platina.sbermarketing.ru/functions/update/bidease" # Обновление статистики Bidease
# */30 4-22 * * * curl "https://dev.platina.sbermarketing.ru/functions/update/vkontakte/statistics" # С 04 до 22 часов каждый пол часа запускает обновление статистики ВК (ведется запись логов, таким образом запоминается что уже было сделано и работа не выполняется повторно)

# Analytics Systems (ниже сбор данных из систем мобильной аналитики)
0 4 * * * curl "https://dev.platina.sbermarketing.ru/functions/update/yandex/appmetrica/logs"
0 5 * * * curl "https://dev.platina.sbermarketing.ru/functions/update/mytracker/rawdata"
0 6 * * * curl "https://dev.platina.sbermarketing.ru/functions/update/appsflyer/aggregated"
0 7 * * * curl "https://dev.platina.sbermarketing.ru/functions/update/appsflyer/rawdata"
0 8 * * * curl "https://dev.platina.sbermarketing.ru/functions/update/adjust/deliverables"

# Monitoring & Aggregation
*/5 * * * * sh -x /home/dev/vm-dataform/src/lib/utilities/logs.sh >> /home/dev/vm-dataform/test.txt # Ведет логирование запущенных процессов в ПГ
59 * * * * curl "https://dev.platina.sbermarketing.ru/functions/parse/logs" # Ведет логирование запущенных процессов в ПГ
0 10 * * * curl "https://dev.platina.sbermarketing.ru/connectors/checkUpdates" # Обрщается к таблицам со статистикой коннекторов и запоминает сколько появилось строк за вчера + отправляет уведомление в ТГ что не отработало
55 9 * * * curl "https://dev.platina.sbermarketing.ru/functions/mobile_reports/update?access_token=m2ZqZrVsU7WvYL3cnOqZUQ1keYuVXrh9k6q9lbp56cqUNjV0WbNERDMTr4DemKcuEstPrIKoKZ6l6RcSQNlwgXdwSGy2eAmIQDl69WkILgTHWToCvzWzk0V2wiSBI27n" # Агрегирует данные в таблицу mobile_reports (агрегат для отчетов, сейчас почти не актуально)

# Other
10 0 * * * curl "https://dev.platina.sbermarketing.ru/functions/extra/exchange_rates?currency_code=USD"
15 0 * * * curl "https://dev.platina.sbermarketing.ru/functions/extra/exchange_rates?currency_code=EUR"

# Ianactive
# * * * * * curl "https://dev.platina.sbermarketing.ru/functions/update/appsflyer/cohort/"
# * * * * * curl "https://dev.platina.sbermarketing.ru/functions/update/yandex/direct/statistics?type=intraday"

# 117996214460225744212@google.com
# 111054007256156650142@google.com