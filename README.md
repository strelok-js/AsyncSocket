# AsyncSocket

AsyncSocket - это библиотека, которая предоставляет логику для асинхронного обмена сообщениями через сокетные соединения. Библиотека не содержит сам движок - для работы требуется передать соответствующий движок (например, WebSocket, TCP Stream, SSH или любой другой сокетный протокол).

## Основные возможности

- **Асинхронные методы отправки**: `send()`, `sendNoReply()`, `sendEmit()`
- **Автоматическое управление ожиданием ответов** с уникальными ID
- **Встроенная система событий** с поддержкой именованных событий
- **Таймауты** для ожидания ответов
- **Promise-based API** для удобной работы с асинхронными операциями

## Архитектура

Библиотека построена на принципе **Engine** - абстрактного движка, который должен быть реализован для конкретной платформы:

- **ServerEngine** - для серверной части
- **Engine** - для клиентской части

Движок должен реализовать интерфейс с методами `send()` и событиями `message`/`connection`.

## Примеры использования

### Серверная часть
```javascript
// Требуется движок для сервера (например, WebSocket.Server, TCP Server, SSH Server)
const wss = new AsyncSocketServer(new ServerEngine());

wss.on('connection', wsc => {
    console.log("New connect");

    wsc.on('message', mess => {
        if(mess.testReply) return mess.reply({message: "Great"});
        else console.log(mess);
    });
});
```

### Клиентская часть
```javascript
// Требуется движок для клиента (например, WebSocket, TCP Client, SSH Client)
const wsc = await AsyncSocketClient(new Engine());

wsc.on('message', console.log);
const data = await wsc.send({testReply: true});
console.log(data.message); //=> "Great"
```

### Работа с событиями
```javascript
// Сервер отправляет события
wss.on('connection', wsc => {
    console.log("New connect");

    setInterval(() => {
        wsc.sendEmit('interval', {message: "Great"})
    }, 5000);
});
```

```javascript
// Клиент слушает события
wsc.on('interval', data => console.log(data.message)); //=> "Great" Every 5 seconds
```

## Установка

```bash
npm install asyncsocket
```

## Требования

Для работы библиотеки необходимо предоставить соответствующий движок, который реализует интерфейс Engine/ServerEngine. Библиотека сама по себе содержит только логику обработки сообщений!!!