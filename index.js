const Discord = require('discord.js');
const request = require("request");
const webshot = require('webshot');
const config = require("./config.json");
const ggames = require("./ggames.json");
const vuvu = new Discord.Client();

var oddsInterval;
var notifyCh = [];

var todayGames = [];
var now = new Date();

getGames = function(){
	ggames.forEach(function(g){
		var gday = new Date(g.start);
		if(now.toJSON().split("T")[0] === gday.toJSON().split("T")[0]){
	  	todayGames.push(g);
	  }	
	});

	var checkon = new Date(now.toJSON().split("T")[0]+" 00:00:00");
	checkon.setDate(checkon.getDate()+1);
	setTimeout(getGames, checkon-now);
}
	
vuvu.on('ready', function() {
    console.log(vuvu.user.username + " is online!");
    getGames();
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
		g = parseInt(args[1]);
		if(!g){ message.channel.send("Please select a game! Use v!games to see todays games."); return false; }
		
		if(args[0] === "start"){
			console.log("Starting Game "+g);		
			checkOdds(message.channel, g);
			todayGames[g-1].i = setInterval(function(){checkOdds(message.channel)}, 5*60*1000);
		}

		if(args[0] === "stop"){
			console.log("Stopping Game "+g);
			message.channel.send("I told you to never tell me the odds.");
			clearInterval(todayGames[g-1].i);
		}

		if(args[0] === "check"){
			console.log("Checking Game "+g);
			checkOdds(message.channel, g);
		}
	}

	if(cmd === "games"){
		var mids = [];
		todayGames.forEach(function(g){ mids.push(g.mid); })
		var matchListURL = "https://www.google.com/async/lr_ml?async=sp:2,emids:"+encodeURIComponent(mids.join(";"))+",mleid:,dlswm:1,iost:-1,ddwe:1,rptoadd:0,vst:fp,inhpt:1,ct:US,hl:en,tz:America%2FLos_Angeles,_fmt:jspb"
		
		request({url: matchListURL, headers: {'user-agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.87 Safari/537.36"}}, function(error, response, body){
			try{ var gMatchList = JSON.parse(body.substring(4)).match_list[11]; }
			catch(e){
				ch.send("Bad JSON! Abort abort.");				
				console.log("Bad JSON");
				return false;
			}
			console.log("Matches Found: " + gMatchList.length);

			matches = "Todays Matches Are:\n";
			for(var i=0; i<gMatchList.length; i++){				
				matches += "["+(i+1)+"] " + gMatchList[i][0][56] + "\n";
			}

			message.channel.send("```ini\n"+matches+"```");
		});
	}

	if(cmd === "ping"){
		message.channel.send("Pong!");
	}

	if(cmd === "test"){
		if(args[0] === "spam"){
			console.log(message.channel);
		}
	}
});
var chirp = true;
var parseOdd = function(odd){
	return {"name": odd[0], "color": odd[1], "p": odd[2]}
}
var match = {
	"odds": [parseOdd(["TeamA", "#0000FF", "50"]), parseOdd(["TeamB", "#FF0000", "50"])]
	,"score": [-1,-1]	
}

var checkOdds = function(ch, g){	
	var matchURL = "https://www.google.com/async/lr_mt_fp?async=sp:2,emid:"+encodeURIComponent(todayGames[g-1].mid)+",ct:US,hl:en,tz:America%2FLos_Angeles,_fmt:jspb";
	console.log(matchURL);
	request({url: matchURL, headers: {'user-agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.87 Safari/537.36"}}, function(error, response, body){
		console.log("----------------------------")
		try{ var gMatch = JSON.parse(body.substring(4)).match_fullpage; }
		catch(e){
			ch.send("Bad JSON! Abort abort.");
			console.log("Stopping Game "+g);
			clearInterval(todayGames[g-1].i);
			console.log("Bad JSON");
			return false;
		}
		var time = gMatch[1][0][22];
		var score = gMatch[1][0][24];
		var odds = gMatch[7][0][2][27][10][1];
		var team = [
			{name:gMatch[1][0][1][0][1], abv: gMatch[1][0][1][0][2]}
			,{name:gMatch[1][0][2][0][1], abv: gMatch[1][0][2][0][2]}
		];

		if(time.length === 3){
			ch.send(gMatch[0][0]+" is over! The results are **"+team[0].abv+"** "+score[0]+" - "+score[1]+" **"+team[1].abv+"**");
			console.log("Stopping Game "+g);
			clearInterval(todayGames[g-1].i);
			return false;
		}
		if(time[6] === "Half-time"){
			if(chirp) ch.send("It's half-time! The score is **"+team[0].abv+"** "+score[0]+" - "+score[1]+" **"+team[1].abv+"**");
			chrip = false;
			return chrip;
		}

		if(match.score[0] !== score[0]){
			if(match.score[0] >= 0) ch.send(team[0].name+" Scored! **"+team[0].abv+"** "+score[0]+" - "+score[1]+" **"+team[1].abv+"**");
			match.score[0] = score[0];
		}
		if(match.score[1] !== score[1]){
			if(match.score[1] >= 0) ch.send(team[1].name+" Scored! **"+team[0].abv+"** "+score[0]+" - "+score[1]+" **"+team[1].abv+"**");
			match.score[1] = score[1];
		}
		
		if(odds === null) return false;
		if(odds[5] === 1){
			var teamA = parseOdd(odds[1]);
			var teamB = parseOdd(odds[2]);
			var draw = parseOdd(odds[3]);
			var msg = "";
			chirp = true;

			if(match.odds[0].p !== teamA.p || match.odds[1].p !== teamB.p){
				match.odds[0] = teamA;
				match.odds[1] = teamB;

				var winprob = '<html><body style="font-family:Verdana;background-color:white;"><div>'
				winprob += '<table style="width:100%;font-size:12px;">'
				winprob += '<tr>'
				winprob += '<td style="text-align:left;">'+teamA.name+'</td>'
				winprob += '<td style="text-align:center;">Draw</td>'
				winprob += '<td style="text-align:right;">'+teamB.name+'</td>'
				winprob += '</tr>'
				winprob += '<tr>'
				winprob += '<td style="text-align:left;color:'+teamA.color+';">'+teamA.p+'%</td>'
				winprob += '<td style="text-align:center;color:rgba(0,0,0,.54);">'+draw.p+'%</td>'
				winprob += '<td style="text-align:right;color:'+teamB.color+'">'+teamB.p+'%</td>'
				winprob += '</tr>'
				winprob += '</table>'
				winprob += '<table style="width:100%;height:15px;border-spacing:0;">'
				winprob += '<td style="width:'+teamA.p+'%;background-color:'+teamA.color+';"></td>'
				winprob += '<td style="width:'+draw.p+'%;background-color:'+draw.color+';"></td>'
				winprob += '<td style="width:'+teamB.p+'%;background-color:'+teamB.color+';"></td>'
				winprob += '</table>'
				winprob += '</div></body></html>'		
				
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

		console.log(match);
		console.log('.');
	});
}

vuvu.login(config.token);
