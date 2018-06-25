const Discord = require('discord.js');
const request = require("request");
const webshot = require('webshot');
const config = require("./config.json");
const ggames = require("./ggames.json");
const cc = require("./countrycodes.json");
const vuvu = new Discord.Client();

var notifyCh = [];
var todayGames = [];
var now = new Date();
var parseOdd = function(odd){ return {"name": odd[0], "color": odd[1], "p": odd[2]} }
var Match = function(game){	
	return {
		mid: game.mid				//MatchID
		,start: game.start 			//Match Start
		,i: game.i					//Interval
		,match: game.match			//Persistent Match Info		
		,audience: game.audience	//Channels to scream at
		,oddsClosed: false			//Flag for Google closing odds
		,send: function(msg, limit=false){			
			this.audience.forEach(function(a){				
				if(!limit || a.chirp){
					a.channel.send(msg);
					if(limit) a.chirp = false;
				}				
			});
		}
		,sendOdds: function(o){
			this.audience.forEach(function(a){				
				if(a.refresh){
					console.log("Sending odds to #"+a.channel.name+" in ["+a.channel.guild.name+"]");
					a.channel.send({
						files: [{ attachment: o,  name: 'winprob.jpg'  }]
					}).then(msg => {
						a.refresh = false; //Cool down
						a.chirp = true; //Reset chirp
						setTimeout(function(){a.refresh = true;}, 5*60*1000);
					}).catch(err => {
						console.log(err.name +": "+err.message+" ("+err.code+")");
						if(err.code ===  50013) a.channel.send("I can't attach images! :(");
					});
				}
			});
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
	}
}

//Handle only current day games
var getGames = function(){
	console.log("Checking games for " + now.toUTCString());
	ggames.forEach(function(g){
		var gday = new Date(g.start);
		if(now.toJSON().split("T")[0] === gday.toJSON().split("T")[0]){
			g.i = null;
			g.match = {
				"odds": [parseOdd(["TeamA", "#0000FF", "50"]), parseOdd(["TeamB", "#FF0000", "50"])]
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
		g = parseInt(args[1])-1;

		if(isNaN(g) || g < 0 || g >= todayGames.length){ 
			message.channel.send("Please select a game! Use v!games to see todays games.");
			return;
		}
		
		if(args[0] === "start"){			
			if(!todayGames[g].audience.find(v => v.channel.id === message.channel.id)){
				console.log("Adding #"+message.channel.name+" in ["+message.guild.name+"] to audience for game "+(g+1));
				todayGames[g].audience.push(Viewer(message.channel));
				console.log(todayGames[g].audience.length + " now listening.");
			} else {
				message.channel.send("You're already tunned in!");
			}	
			if(todayGames[g].i === null) todayGames[g].i = setInterval(todayGames[g].check.bind(todayGames[g]), 5*1000);
			
		}

		if(args[0] === "stop"){			
			var i = todayGames[g].audience.findIndex(v => v.channel.id  === message.channel.id);			

			if(i >= 0) {
				console.log("Removing #"+message.channel.name+" in ["+message.guild.name+"] to audience for game "+(g+1));
				todayGames[g].audience.splice(i, 1);
				message.channel.send("I told you to never tell me the odds.");
				console.log(todayGames[g].audience.length + " now listening.");
				if(todayGames[g].audience.length === 0)	todayGames[g].stop();
			}
		}

		if(args[0] === "check"){
			console.log("Checking Game "+(g+1)+" for #"+message.channel.name+" in ["+message.guild.name+"]");			
			var ch = todayGames[g].audience.find(v => v.channel.id === message.channel.id);			
			if(ch) ch.refresh = true;
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

	if(cmd === "ping"){
		message.channel.send("Pong!");
	}
});

var checkMatch = function(g){	
	var matchURL = "https://www.google.com/async/lr_mt_fp?async=sp:2,emid:"+encodeURIComponent(todayGames[g].mid)+",ct:US,hl:en,tz:America%2FLos_Angeles,_fmt:jspb";	

	request({url: matchURL, headers: {'user-agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.87 Safari/537.36"}}, function(error, response, body){		
		try{
			console.log("Parsing Game "+(g+1)+" ("+matchURL+")");
			parseMatch(JSON.parse(body.substring(4)).match_fullpage, g);
		}
		catch(e){			
			//todayGames[g].stop();
			console.log("Bad JSON");
			console.log(e);			
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
	var odds = gmatch[7][0][2][27][10][1];
	var minute = gmatch[1][0][11]; //0:Minute
	var flag = gmatch[1][0][24][1]; //Possible Prediction Closing Flag when set to 2
	var team = [
		{name:gmatch[1][0][1][0][1], abv: gmatch[1][0][1][0][2], code:'white'}
		,{name:gmatch[1][0][2][0][1], abv: gmatch[1][0][2][0][2], code:'white'}
	];
	team.forEach(team => { 
		var country = cc.find(c => c.name === team.name);
		if(country) team.code = country.code.toLowerCase();
	});
	var scorebox = (score !== null) ? ":flag_"+team[0].code+": "+score[0]+" - "+score[1]+" :flag_"+team[1].code+":" : "";

	//Last call prediction	
	if(minute !== null && minute[0] === 79 && !game.oddsClosed){
		game.audience.forEach(a => {a.refresh = true;});
		game.send("Last Call Prediction Coming Up!");
		game.oddsClosed = true;
	}
	
	//Googles time array varies
	if(time.length === 3){
		game.send(title+" is over!\nFinal Score: "+scorebox);
		console.log("Game "+(g+1)+" ended");
		game.stop();
		return false;
	}
	if(time[6] === "Half-time"){
		game.send("It's half-time!\nCurrently: "+scorebox, true);
		return;
	}

	//Check for goal
	if(score !== null){
		for(var i=0; i<match.score.length; i++){
			if(match.score[i] !== score[i]){
				if(match.score[i] >= 0) game.send(team[i].name+" GOOOOOOOOOOOOOL! " + scorebox);
				match.score[i] = score[i];
			}
		}
	}
	
	//Ensure odds exist and if refresh required
	if(odds !== null && game.audience.find(a => a.refresh)){
		console.log("Generating odds ("+odds[5]+") for Game "+(g+1));
		//Google: 1 is populated, 2 is pending.
		if(odds[5] === 1){
			var teamA = parseOdd(odds[1]);
			var teamB = parseOdd(odds[2]);
			var draw = parseOdd(odds[3]);
			var msg = "";			

			//Check if odds have changed
			if(match.odds[0].p !== teamA.p || match.odds[1].p !== teamB.p || game.audience.find(a => a.refresh)){
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
				
				game.sendOdds(render);		
			}
		} else if(odds[5] === 2){
			game.send(odds[4], true);			
		}
	}
}

vuvu.login(config.token);