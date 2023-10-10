# OpenlyBot

This is a sample bot for Telegram, made as an entry for [Telegram 2023 Mini App Contest](https://t.me/contest/327).

This is an incomplete project. In the future, it will replace the current (non-Mini App) UI of already existing dating service [Openly](https://t.me/OpenlyBot).

For now, you can either try out the prototype in [the test environment](https://t.me/OpenlyBot/test) (**note**: this version is filled up with mocked profiles instead of actual people), or clone and modify this repository to fit your personal needs (see the [Deployment](#Deployment) section).

## Usage

Openly is a dating service for open-minded people. To start, open [the mini app](https://t.me/OpenlyBot/test) and follow step-by-step process to sign up. After answering a couple of basic questions you will be able to search people nearby or anywhere in the world. To search people nearby you will need to provide access to your current geolocation.

In the list of people, swipe either left to dislike a person, or right to like them. As soon as the interest will be mutual, we'll send you a notification with a link to a person's Telegram profile, so you can start a chat.

## Known issues

Unfortunately, Telegram does not provide (yet) a reliable way to prevent vertical swipe gestures from "leaking" to the Telegram client. This means that some touch gestures can be interpreted incorrectly and lead to expanding/closing Mini App instead of interacting with its elements. This is especially noticable on Android devices.

## Deployment

The process of cloning this bot/app is rather straightforward. It's written in Node.js using Express framework and all data is stored in SQLite. This means that deployment does not require installation and configuration of an external database (but the source code can be modified to use it, of course).

First, make sure you have the latest version of [Node](https://nodejs.org/en) installed. It's also recommended to have [Git](https://git-scm.com/downloads) installed (to clone this repository). To keep the server running you can install [PM2](https://pm2.keymetrics.io/), for example. You can also use [Nginx](https://nginx.org/en/download.html) as a reverse proxy in front of this app.

Clone this repository into any directory:
```
git clone https://github.com/hip-hyena/OpenlyBot.git
```
(or, if you don't use Git, just download this repo as a ZIP file and unpack it in any directory)

Go to directory where you cloned the repository and install dependencies:
```
cd OpenlyBot
npm install
```

Now you need to configure your version of this app.

Visit [BotFather](https://t.me/BotFather) and create your bot. You can choose any name/username/description.Also type `/newapp` and create a Mini App associated with the bot you've just created. Similarly, use "`https://<YOUR_HOSTNAME>/`" as an URL for your app. If you use Nginx, you can use the public path you've configured as `<YOUR_HOSTNAME>`.

Now create a text file named `.env` in the root directory of this repository. It should have the following contents:
```
TELEGRAM_USERNAME=<BOT_USERNAME>
TELEGRAM_TOKEN="<BOT_TOKEN>"
MINIAPP_HOST=<PUBLIC_URL>
MINIAPP_PORT=<INTERNAL_PORT>
```

Replace placeholders in angle brackets with the appropriate values and this file (enter `<BOT_USERNAME>` without an @-sign).

That's all for configuration. Now you can run the server:
```
node server.js
```

Or, if you're using `PM2`, you can add this app to the list of continuously running scripts:
```
pm2 start --name YourBotName server.js
pm2 save
```

If you're using `Nginx`, don't forget to make sure you've configured it to correctly proxy requests from `<PUBLIC_URL>` to `localhost:<INTERNAL_PORT>`. You also may need to configure [Certbot](https://certbot.eff.org/) to acquire HTTPS certificates (you can follow [this tutorial](https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-20-04) for details).

## Mocking data

It can be useful (for testing purposes) to fill up the database with random fake profiles. To do this, run `mock.js` script:

```
node mock.js
```

The newly created profiles with use profiles from `loremflickr.com`, and will have `tg_id` < 0 (so you can easily tell them apart from real profiles).