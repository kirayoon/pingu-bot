const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} = require('@discordjs/voice');
const axios = require('axios');
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');
const { FFmpeg } = require('prism-media');

const config = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});
const token = config.TOKEN;
const clientId = config.CLIENT_ID;
const clientSecret = config.CLIENT_SECRET;
const prefix = '!pingu';

let spotifyAccessToken = '';
const audioPlayer = createAudioPlayer();

async function getSpotifyAccessToken() {
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const { data } = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({ grant_type: 'client_credentials' }),
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  spotifyAccessToken = data.access_token;
  setTimeout(getSpotifyAccessToken, data.expires_in * 1000);
}

client.on('ready', async () => {
  console.log(`logged: ${client.user.tag}`);
  await getSpotifyAccessToken();
});

client.on('messageCreate', async (msgObj) => {
  const msg = msgObj.content;

  if (!msg.startsWith(prefix)) return;

  const message = msg.slice(prefix.length).trim().split(' ');
  const command = message.shift().toLowerCase();

  if (command === 'play') {
    if (!message.length) {
      return msgObj.reply('i need a song name :v');
    }

    const spotifyQuery = message.join(' ');
    const songObj = await searchSpotify(spotifyQuery);
    if (songObj) {
      playSong(msgObj, songObj);
    } else {
      msgObj.reply('i couldnt find the song ):');
    }
  }

  return;
});

const searchSpotify = async (query) => {
  try {
    const response = await axios.get('https://api.spotify.com/v1/search', {
      params: {
        q: query,
        type: 'track',
      },
      headers: {
        Authorization: `Bearer ${spotifyAccessToken}`,
      },
    });

    const song = response.data.tracks.items[0];

    return {
      name: song.name,
      artist: song.artists.map((artist) => artist.name).join(', '),
      url: song.external_urls.spotify,
    };
  } catch (err) {
    console.error('error searching spotify:', err);
    return null;
  }
};

const playSong = async (msgObj, songInfo) => {
  const voiceChannel = msgObj.member.voice.channel;

  if (!voiceChannel) {
    return msgObj.reply('..u need to be in a voice channel...');
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guildId,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  const { videos } = await ytSearch(songInfo.name);

  if (!videos.length) {
    return msgObj.reply('i couldnt find the song ):');
  }

  const url = videos[0].url;
  console.log(url);

  msgObj.channel.send(`now playing: ${songInfo.name} - ${songInfo.artist}`);

  const stream = ytdl(url, { filter: 'audioonly' });
  const resource = createAudioResource(stream);

  audioPlayer.play(resource);
  connection.subscribe(audioPlayer);

  audioPlayer.on(AudioPlayerStatus.Idle, () => {
    connection.destroy();
  });
};

client.login(token);
