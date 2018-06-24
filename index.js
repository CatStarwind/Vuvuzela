const Discord = require('discord.js');
const request = require("request");
const webshot = require('webshot');
const config = require("./config.json");
const vuvu = new Discord.Client();
var matchURL = "https://www.google.com/async/lr_mt_fp?ei=O7UvW4HPBP-w0PEP0daT8Ak&rlz=1C1CHFX_enUS529US529&yv=3&async=sp:2,lmid:%2Fm%2F030q7,emid:%2Fg%2F11f4qd_7gl,tab:dt,ct:US,hl:en,tz:America%2FLos_Angeles,_fmt:jspb";
	
vuvu.on('ready', function() {
    console.log(vuvu.user.username + " is online!");
});

vuvu.on("guildCreate", guild => {
  // This event triggers when the bot joins a guild.
  console.log(`New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members!`);
  vuvu.user.setActivity(`Serving ${vuvu.guilds.size} servers`);
});

vuvu.on('message', message => {
	if(message.author.bot) return;
	if(message.content.indexOf(config.prefix) !== 0) return;

	var args = message.content.slice(config.prefix.length).trim().split(/ +/g);
	var cmd = args.shift().toLowerCase();

	if(cmd === "odds"){
		if(args[0] === "start"){
			checkOdds(message.channel);
			oddsInterval = setInterval(function(){checkOdds(message.channel)}, 5*60*1000);
		}

		if(args[0] === "stop"){
			message.channel.send("I told you to never tell me the odds.");
			clearInterval(oddsInterval);
		}
	}

	if(cmd === "url"){
		matchURL = args[0];
		message.channel.send("New Match URL Set!");
		console.log(matchURL);
	}

	if(cmd === "ping"){
		message.channel.send("Pong!");
	}
});
var chirp = true;
var parseOdd = function(odd){
	return {"name": odd[0], "color": odd[1], "p": odd[2]}
}
var matchOdds = [parseOdd(["TeamA", "#0000FF", "50"]), parseOdd(["TeamB", "#FF0000", "50"]), 0]

var checkOdds = function(ch){
	request({url: matchURL, headers: {'user-agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.87 Safari/537.36"}}, function(error, response, body){
		console.log("----------------------------")
		try{ var match = JSON.parse(body.substring(4)).match_fullpage; }
		catch(e){
			ch.send("Bad JSON! Abort abort.");
			clearInterval(oddsInterval);
			console.log("Bad JSON");
			return false;
		}
		var time = match[1][0][22][6];
		var odds = match[7][0][2][27][10][1];
		console.log(JSON.stringify(match[7][0][2]));
		console.log(match[1][0][22]);
		console.log(odds);
		if(odds === null) return false;
		if(time === "Half-time"){
			if(chirp) ch.send("It's Half-time!");
			chrip = false;
			return false;
		}

		if(odds[5] === 1){
			var teamA = parseOdd(odds[1]);
			var teamB = parseOdd(odds[2]);
			var msg = "";
			chirp = true;

			if(matchOdds[0].p !== teamA.p || matchOdds[1].p !== teamB.p){
				matchOdds[0] = teamA;
				matchOdds[1] = teamB;
				
				var winprob = '<html><body style="font-family:Verdana;background-color:white;"><div>'
				winprob += '<table style="width:100%;font-size:12px;">'
				winprob += '<tr>'
				winprob += '<td style="text-align:left;">'+matchOdds[0].name+'</td>'
				winprob += '<td style="text-align:center;">Draw</td>'
				winprob += '<td style="text-align:right;">'+matchOdds[1].name+'</td>'
				winprob += '</tr>'
				winprob += '<tr>'
				winprob += '<td style="text-align:left;color:'+matchOdds[0].color+';">'+matchOdds[0].p+'%</td>'
				winprob += '<td style="text-align:center;color:rgba(0,0,0,.54);">'+odds[3][2]+'%</td>'
				winprob += '<td style="text-align:right;color:'+matchOdds[1].color+'">'+matchOdds[1].p+'%</td>'
				winprob += '</tr>'
				winprob += '</table>'
				winprob += '<table style="width:100%;height:15px;border-spacing:0;">'
				winprob += '<td style="width:'+matchOdds[0].p+'%;background-color:'+matchOdds[0].color+';"></td>'
				winprob += '<td style="width:'+odds[3][2]+'%;background-color:'+odds[3][1]+';"></td>'
				winprob += '<td style="width:'+matchOdds[1].p+'%;background-color:'+matchOdds[1].color+';"></td>'
				winprob += '</table>'
				winprob += '</div></body></html>'		
				//console.log(winprob);
				var render = webshot(winprob, {siteType:'html', windowSize:{width:400, height:55}, shotOffset:{ left: 0, right: 0, top: 9, bottom: 0 }});
				
				ch.send({
					files: [{ attachment: render,  name: 'winprob.jpg'  }]
				}).catch(err => {
					console.log(err); if(err.code ===  50013){message.channel.send("I can't attach images! :(")} 
				});
			}	
		} else if(odds[5] === 2){
			if(chirp) ch.send(odds[4]);
			chirp = false;			
		}
	});
}

vuvu.login(config.token);
