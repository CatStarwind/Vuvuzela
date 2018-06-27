const Discord = require('discord.js');
const request = require("request");
const webshot = require('webshot');
const config = require("./config.json");
const ggames = require("./ggames.json");
const cc = require("./countrycodes.json");
const vuvu = new Discord.Client();
const oddsTimer = 10; //Minutes

var notifyCh = [];
var todayGames = [];
var parseOdd = function(odd){ return {"name": odd[0], "color": odd[1], "p": odd[2]} }
var Match = function(game){	
	return {
		mid: game.mid				//MatchID
		,start: game.start 			//Match Start
		,i: game.i					//Interval
		,match: game.match			//Persistent Match Info		
		,audience: game.audience	//Channels to scream at
		,oddsClosed: false			//Flag for Google closing odds
		,scoreCheck: []				//Channels requesting scores
		,send: function(msg, limit=false){			
			this.audience.forEach(function(a){				
				if(!limit || a.chirp){
					a.channel.send(msg);
					if(limit) a.chirp = false;
				}				
			});
		}
		,sendOdds: function(msg){
			var game = this;
			this.audience.forEach(function(a){
				if(a.refresh){
					if(typeof msg === "string"){
						game.send(msg, true);						
					} else {
						console.log("Sending odds to #"+a.channel.name+" in ["+a.channel.guild.name+"]");
						a.channel.send(msg).then(msg => {
							a.refresh = false; //Cool down
							a.chirp = true; //Reset chirp
							if(a.to === null) a.to = setTimeout(function(){this.refresh = true; this.to = null;}.bind(a), oddsTimer*60*1000);
						}).catch(err => {
							console.log(err.name +": "+err.message+" ("+err.code+")");
							if(err.code ===  50013) a.channel.send("I can't attach images! :(");
						});
					}
				}
			});
		}
		,sendScore: function(scorebox){
			if(scorebox === "") scorebox = "N/A";
			this.scoreCheck.forEach(function(ch){				
				ch.send(scorebox);
			});
			this.scoreCheck = [];
		}
		,check: function(){			
			checkMatch(todayGames.findIndex(g => g.mid === this.mid));
		}		
		,stop: function(i){
			console.log("Stopping Game "+(todayGames.findIndex(g => g.mid === this.mid)+1));			
			clearInterval(this.i);
			this.i = null;
			this.audience = [];	
		}
	}
}
var Viewer = function(ch){
	return {
		channel: ch
		,refresh: true
		,chirp: true
		,to: null
	}
}

//Handle only current day games
var getGames = function(){
	var now = new Date();
	todayGames = [];
	console.log("Checking games for " + now.toUTCString());
	ggames.forEach(function(g){
		var gday = new Date(g.start);
		if(now.toJSON().split("T")[0] === gday.toJSON().split("T")[0]){
			g.i = null;
			g.match = {
				"odds": [parseOdd(["TeamA", "#FF0000", "40"]), parseOdd(["TeamB", "#0000FF", "40"]), parseOdd(["Draw", "#777777", "20"])]
				,"score": [-1,-1]
				,"refresh": true 
				,"chirp": true
			}			
			g.audience = [];

	  		todayGames.push(Match(g));
	  	}
	});
	console.log(todayGames.length + " matches found.")

	//Check again next day
	var checkon = new Date(now.toJSON().split("T")[0]+" 00:00:00");
	checkon.setDate(checkon.getDate()+1);
	setTimeout(getGames, checkon-now);
}
	
vuvu.on('ready', function() {
    console.log(vuvu.user.username + " is online!");
    vuvu.user.setActivity(`BZZZZing ${vuvu.guilds.size} servers`);
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
		var g = parseInt(args[1])-1;
		if(isNaN(g) || g < 0 || g >= todayGames.length){ 
			message.channel.send("Please select a game! Use v!games to see todays games.");
			return;
		}
		var game = todayGames[g];
		
		if(args[0] === "start"){			
			if(!game.audience.find(v => v.channel.id === message.channel.id)){
				console.log("Adding #"+message.channel.name+" in ["+message.guild.name+"] to audience for game "+(g+1));
				game.audience.push(Viewer(message.channel));
				console.log(game.audience.length + " now listening.");
			} else {
				message.channel.send("You're already tunned in!");
			}	
			if(game.i === null) game.i = setInterval(game.check.bind(game), 5*1000);
			
		}

		if(args[0] === "stop"){			
			var i = game.audience.findIndex(v => v.channel.id  === message.channel.id);

			if(i >= 0) {
				console.log("Removing #"+message.channel.name+" in ["+message.guild.name+"] to audience for game "+(g+1));
				game.audience.splice(i, 1);
				message.channel.send("I told you to never tell me the odds.");
				console.log(game.audience.length + " now listening.");
				if(game.audience.length === 0)	game.stop();
			}
		}

		if(args[0] === "check"){
			console.log("Checking Game "+(g+1)+" for #"+message.channel.name+" in ["+message.guild.name+"]");			
			var ch = game.audience.find(v => v.channel.id === message.channel.id);		
			ch ? ch.refresh = true : game.audience.push(Viewer(message.channel));

			if(game.i === null){
				checkMatch(g);
				setTimeout(function(){					
					var i = this.audience.findIndex(v => v.channel.id  === message.channel.id);
					this.audience.splice(i, 1);
				}.bind(game), 5*1000);
			}

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

			matches = "Todays Matches Are:\n";
			for(var i=0; i<gMatchList.length; i++){				
				matches += "["+(i+1)+"] " + gMatchList[i][0][56] + "\n";
			}
			message.channel.send("```ini\n"+matches+"```");
		});
	}

	if(cmd === "score"){
		var g = parseInt(args[0])-1;

		if(isNaN(g) || g < 0 || g >= todayGames.length){ 
			message.channel.send("Please select a game! Use v!games to see todays games.");
			return;
		}
		console.log("Checking Game "+(g+1)+" Score for #"+message.channel.name+" in ["+message.guild.name+"]");
		var game = todayGames[g];	
		game.scoreCheck.push(message.channel);
		if(game.i === null) checkMatch(g);
	}

	if(cmd === "help"){
		var helptext = "```css\nVuvuzela Commands```"
		helptext += "**v!games** - Displays today's games.\n"
		helptext += "**v!odds start [gameid]** - Start probability messages for selected game.\n"
		helptext += "**v!odds stop [gameid]** - Stop probability messages for selected game.\n"
		helptext += "**v!odds check [gameid]** - Check probability for selected game.\n"
		helptext += "**v!score [gameid]** - Check game score.\n"
		helptext += "**v!ping** - Pong!"
		helptext += "```# Don't include the example brackets when using commands!```"

		message.channel.send(helptext);
	}

	if(cmd === "ping"){
		message.channel.send("Pong!");
	}

	/*
	if(cmd === "test"){
		var fs = require("fs");
		var json = fs.readFileSync('test.json', 'utf-8');
		var game = todayGames[1];
		if(!game.audience.find(v => v.channel.id === message.channel.id)) game.audience.push(Viewer(message.channel));
		parseMatch(JSON.parse(json).match_fullpage, 1);
	}
	*/
});

var checkMatch = function(g){	
	var matchURL = "https://www.google.com/async/lr_mt_fp?async=sp:2,emid:"+encodeURIComponent(todayGames[g].mid)+",ct:US,hl:en,tz:America%2FLos_Angeles,_fmt:jspb";	

	request({url: matchURL, headers: {'user-agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.87 Safari/537.36"}}, function(error, response, body){		
		try{
			console.log("Parsing Game "+(g+1)+" ("+matchURL+")");
			parseMatch(JSON.parse(body.substring(4)).match_fullpage, g);
		}
		catch(e){
			/*
			todayGames[g].send("Google killed "+(g+1)+". :( Please restart with `v!odds start "+(g+1)+"`")
			todayGames[g].stop();
			console.log("Bad JSON");
			console.log(e);
			*/
			return false;
		}
	});
}

parseMatch = function(gmatch, g){	
	//Grab from Google match_info Array
	var game = todayGames[g];
	var match = game.match;
	var title = gmatch[0][0];
	var time = gmatch[1][0][22];
	var score = gmatch[1][0][24];
	var odds = gmatch[7][0][2][27][10];
	odds = (odds) ? odds[1] : null; //Stop-gap because Google is getting angry	
	var minute = gmatch[1][0][11]; //0:Minute
	//var flag = gmatch[1][0][24][1] //Possible Prediction Closing Flag when set to 2
	var team = [
		{name:gmatch[1][0][1][0][1], abv: gmatch[1][0][1][0][2], code:'white'}
		,{name:gmatch[1][0][2][0][1], abv: gmatch[1][0][2][0][2], code:'white'}
	];
	team.forEach(team => { 
		var country = cc.find(c => c.name === team.name);
		if(country) team.code = country.code.toLowerCase();
	});
	var scorebox = (score !== null) ? ":flag_"+team[0].code+": "+score[0]+" - "+score[1]+" :flag_"+team[1].code+":" : "";

	//Yell Requested Scores
	if(game.scoreCheck.length) game.sendScore(scorebox);

	//Last call prediction	
	if(minute !== null && minute[0] === 79 && !game.oddsClosed){
		game.audience.forEach(a => {a.refresh = true;});
		game.send("Last Call Prediction for "+title+" Coming Up!");
		game.oddsClosed = true;
	}
	
	//Googles time array varies
	if(time.length === 3){
		var ecolor = match.odds[(score[0] === score[1] ? 2 : (score[0] > score[1] ? 0 : 1))].color;
		var rich = { "embed": {
			"title": "Full-time!"
			, "description": scorebox
			, "color": parseInt(ecolor.replace("#", "0x"), 16) 
		}}
		game.send(rich);
		console.log("Game "+(g+1)+" ended");
		game.stop();
		return false;
	}
	if(time[6] === "Half-time"){		
		var ecolor = odds[(score[0] === score[1] ? 3 : (score[0] > score[1] ? 1 : 2))][1];		
		var rich = { "embed": {
			"title": "Half-time!"
			, "description": scorebox
			, "color": parseInt(ecolor.replace("#", "0x"), 16) 
		}}
		game.send(rich, true);
		return;
	}
	
	//Check for goal
	if(score !== null){
		for(var i=0; i<match.score.length; i++){
			if(match.score[i] !== score[i]){
				if(match.score[i] >= 0){
					var cantor = { "embed": { 
						"title": team[i].name.toUpperCase() + " GOOOOOOOOOOOOOL!"
						,"description": scorebox
						, "color": parseInt(match.odds[i].color.replace("#", "0x"), 16) 
					}}					
					game.send(cantor);
				}
				match.score[i] = score[i];
			}
		}
	}
	
	
	//Ensure odds exist
	if(odds !== null){		
		//Google: 1 is populated, 2 is pending.
		if(odds[5] === 1){
			match.odds[0] = parseOdd(odds[1]);
			match.odds[1] = parseOdd(odds[2]);
			match.odds[2] = parseOdd(odds[3]);						

			//Check if refresh requested
			if(game.audience.find(a => a.refresh)){
				console.log("Generating odds ("+odds[5]+") for Game "+(g+1));
				var teamA = match.odds[0];
				var teamB = match.odds[1];
				var draw = match.odds[2];

				var winprob = '<html><body style="font-family:Verdana;background-color:'+(game.oddsClosed ? "paleturquoise" : "white")+';"><div>'
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
				
				game.sendOdds({ files: [{ attachment: render,  name: 'winprob.jpg'  }] });
			}
		} else if(odds[5] === 2){
			game.sendOdds(odds[4]);					
		}
	}
}

vuvu.login(config.token);