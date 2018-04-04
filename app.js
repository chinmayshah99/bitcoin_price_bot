var restify = require('restify');
var builder = require('botbuilder');
var request = require("request");
var mul_factor = 1.0;

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
	console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
	appId: process.env.MICROSOFT_APP_ID,
	appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

var inMemoryStorage = new builder.MemoryBotStorage();

var bot = new builder.UniversalBot(connector, [
	// Opening  statement
	function (session) {
		session.send("Hi!");
		session.send("Welcome Bit Coin Rate Teller");
		builder.Prompts.text(session, "Please provide preferred currency");
	},
	// asks user for preferred currecy, and stores it indivisually for each user
	function (session, results) {
		session.userData.currency = results.response.toUpperCase();
		session.send(`currency confirmed.  details:: ${session.userData.currency} `);
		session.beginDialog('start', session.userData.currency);
	}
]).set('storage', inMemoryStorage); // Register in-memory storage

// adding for mudularity
bot.dialog('currency_set', [
	function (session) {
	}
]);


// For user entered input, check the conversion rate and set it as global variable
// ML can be added so that currency can be found easily
bot.dialog('start', [
	//...waterfall steps...,
	function (session) {
		// if currency is USD, don't set multiplication factor as 1
		if (session.userData.currency === "USD") {
			mul_factor *= 1;
		}
		// if curr not USD, find conversion rate
		else {
			console.log(session.userData.currency);
			var url1 = 'http://api.fixer.io/latest?base=USD&symbols=' + session.userData.currency;
			request({
				url: url1,
				json: true
			}, function (error, response, body) {
				if (!error && response.statusCode === 200) {
					var temp = session.userData.currency;
					
					// finding mult_factor from JSON
					var temp_rate = body.rates;
					temp_rate = JSON.stringify(temp_rate);
					temp_rate = temp_rate.replace('}', '');
					temp_rate = temp_rate.substring(7);
					temp_rate = parseFloat(temp_rate);
					mul_factor = temp_rate;
				}
			})
		}
		session.beginDialog('let');
	}
]);

bot.dialog('let', [
	function (session) {
		var url = "https://www.bitstamp.net/api/v2/ticker/btcusd/";
		request({
			url: url,
			json: true
		}, function (error, response, body) {
			if (!error && response.statusCode === 200) {
				// mult_factor should be multiplied to everything
				var value = (body.last)*mul_factor;
				var open = (body.open * mul_factor).toFixed(2);
				var high = (body.high* mul_factor).toFixed(2);
				var low = (body.low* mul_factor).toFixed(2);
				var rise = (open - value).toFixed(2);
				var rise_per = (((open - value) / value) * 100).toFixed(2);
				var value1 = (value).toFixed(2);
/*
				var message1 = new builder.Message(session)
					.addAttachment({
						"$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
						"type": "AdaptiveCard",
						"version": "1.0",
						"body": [
							{
								"type": "Container",
								"items": [
									{
										"type": "TextBlock",
										"text": "Bitcoin price",
										"size": "medium",
										"isSubtle": true
									},
									{
										"type": "TextBlock",
										"text": new Date().toLocaleString(),
										"isSubtle": true
									}
								]
							},
							{
								"type": "Container",
								"spacing": "none",
								"items": [
									{
										"type": "ColumnSet",
										"columns": [
											{
												"type": "Column",
												"width": "stretch",
												"items": [
													{
														"type": "TextBlock",
														"text": value1,
														"size": "extraLarge"
													},
													{
														"type": "TextBlock",
														"text": rise_per,
														"size": "small",
														"color": "attention",
														"spacing": "none"
													}
												]
											},
											{
												"type": "Column",
												"width": "auto",
												"items": [
													{
														"type": "FactSet",
														"facts": [
															{
																"title": "Open",
																"value": open
															},
															{
																"title": "High",
																"value": high
															},
															{
																"title": "Low",
																"value": low
															}
														]
													}
												]
											}
										]
									}
								]
							}
						]
				});
				session.send(message1);
*/
				var msg = new builder.Message(session);
				msg.attachments([
					new builder.HeroCard(session)
						.title("Bit Coin rate at moment")
						.subtitle(new Date().toLocaleString()) // displays date and time)
						.text("Current price: "+value1 + "\n" 
							+ "Change: "+rise + " "+ rise_per+"%\n"
							+ "Open: "+ open+"\n"
							+ "High: "+ high+"\n"
							+ "Low: "+ low)
						.buttons([
							builder.CardAction.imBack(session, "rate", "Rate"),
							builder.CardAction.openUrl(session, "https://charts.bitcoin.com/chart/price#lf", "Graph")
						])
				]);
				session.send(msg);
			}
		})
		session.endConversation();
	}
]).triggerAction({ matches: /(rate|add)/i });