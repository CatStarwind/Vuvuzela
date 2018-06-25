const Discord = require('discord.js');
const request = require("request");
const webshot = require('webshot');
const config = require("./config.json");
const ggames = require("./ggames.json");
const vuvu = new Discord.Client();

var chirp = true;
var notifyCh = [];
var todayGames = [];
var now = new Date();
var parseOdd = function(odd){ return {"name": odd[0], "color": odd[1], "p": odd[2]} }

//Handle only current day games
var getGames = function(){
	console.log("Checking games for "+now);
	ggames.forEach(function(g){
		var gday = new Date(g.start);
		if(now.toJSON().split("T")[0] === gday.toJSON().split("T")[0]){
			g.i = null; //Internval
			g.match = { "odds": [parseOdd(["TeamA", "#0000FF", "50"]), parseOdd(["TeamB", "#FF0000", "50"])], "score": [-1,-1] } //Persistent Match Info
			g.audience = []; //Channels to scream at
	  		todayGames.push(g);
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
		if(isNaN(g) || g < 0 || g >= todayGames.length){ message.channel.send("Please select a game! Use v!games to see todays games."); return false; }
		
		if(args[0] === "start"){
			console.log("Adding "+message.channel.name+" in "+message.guild.name+" to audience for game "+g);
			if(!todayGames[g].audience.find(c => c.id === message.channel.id)){
				todayGames[g].audience.push(message.channel);
			}			
			checkMatch(message.channel, g);
			todayGames[g].i = setInterval(function(){checkMatch(message.channel)}, 5*1000);
		}

		if(args[0] === "stop"){
			console.log("Stopping Game "+g);
			message.channel.send("I told you to never tell me the odds.");
			clearInterval(todayGames[g].i);
		}

		if(args[0] === "check"){
			console.log("Checking Game "+g);
			checkMatch(message.channel, g);
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

	if(cmd === "test"){
		if(args[0] === "spam"){			
			message.channel.send("Adding "+message.channel.name+" in "+message.guild.name+" to audience for game ");
		}
	}
});

var checkMatch = function(ch, g){
	console.log("----------------------------");
	var matchURL = "https://www.google.com/async/lr_mt_fp?async=sp:2,emid:"+encodeURIComponent(todayGames[g].mid)+",ct:US,hl:en,tz:America%2FLos_Angeles,_fmt:jspb";
	console.log(matchURL);

	request({url: matchURL, headers: {'user-agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.87 Safari/537.36"}}, function(error, response, body){		
		try{ parseMatch(JSON.parse(body.substring(4)).match_fullpage, ch, g); }
		catch(e){
			ch.send("Bad JSON! Abort abort.");
			console.log("Stopping Game "+g);
			clearInterval(todayGames[g].i);
			console.log("Bad JSON");
			return false;
		}
	});
}

parseMatch = function(gmatch, ch, g){
	//Grab from Google match_info Array
	var match = todayGames[g].match;
	var title = gmatch[0][0];
	var time = gmatch[1][0][22];
	var score = gmatch[1][0][24];
	var odds = gmatch[7][0][2][27][10][1];
	var team = [
		{name:gmatch[1][0][1][0][1], abv: gmatch[1][0][1][0][2]}
		,{name:gmatch[1][0][2][0][1], abv: gmatch[1][0][2][0][2]}
	];
	var scorebox = "**"+team[0].abv+"** "+score[0]+" - "+score[1]+" **"+team[1].abv+"**";

	console.log("Parsing Game "+g+": "+title);

	//Googles time array varies
	if(time.length === 3){
		ch.send(title+" is over! The results are "+scorebox);
		console.log("Stopping Game "+g);
		clearInterval(todayGames[g].i);
		return false;
	}
	if(time[6] === "Half-time"){
		if(chirp) ch.send("It's half-time! The score is "+scorebox);		
		return chrip=false;
	}

	//Check for goal
	for(var i=0; i<score.length; i++){
		if(match.score[i] !== score[i]) ch.send(team[0].name+" GOOOOOOOOOOOOOL! " + scorebox);
		match.score[i] = score[i];
	}

	//Ensure odds exist and if refresh required
	if(odds === null && match.refresh){
		//Google: 1 is populated, 2 is pending.
		if(odds[5] === 1){
			var teamA = parseOdd(odds[1]);
			var teamB = parseOdd(odds[2]);
			var draw = parseOdd(odds[3]);
			var msg = "";
			match.refresh = false;
			chirp = true; //Reset chirp

			//Check if odds have changed
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

				setTimeout(function(){match.refresh = true;}, 5*60*1000)
			}
		} else if(odds[5] === 2){
			if(chirp) ch.send(odds[4]);
			chirp = false;	
		}
	}
}

vuvu.login(config.token);