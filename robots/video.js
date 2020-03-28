const gm = require('gm').subClass({ imageMagick: true });
const state = require('./state');
const videoshow = require('videoshow');

async function robot() {
  const content = state.load();

  await convertAllImages(content);
  // await createAllSentences(content);
  // await createYouTubeThumbnail();
  // await createAfterEffectsScript(content);
  await renderVideoWithNode(content);

  state.save(content);

  async function convertAllImages(content) {
    for (let sentenceIndex = 0; sentenceIndex < content.sentences.length; sentenceIndex++) {
      await convertImage(sentenceIndex);
    }

    async function convertImage(sentenceIndex) {
      return new Promise((resolve, reject) => {
        const inputFile = `./content/${sentenceIndex}-original.png[0]`;
        const outputFile = `./content/${sentenceIndex}-converted.png`;
        const width = 1920;
        const height = 1080;

        gm()
          .in(inputFile)
          .out('(')
          .out('-clone')
          .out('0')
          .out('-blur', '0x9')
          .out('-background', 'white')
          .out('-resize', `${width}x${height}^`)
          .out(')')
          .out('(')
          .out('-clone')
          .out('0')
          .out('-background', 'white')
          .out('-resize', `${width}x${height}`)
          .out(')')
          .out('-delete', '0')
          .out('-gravity', 'center')
          .out('-compose', 'over')
          .out('-composite')
          .out('-extent', `${width}x${height}`)
          .write(outputFile, error => {
            if (error) return reject(error);
            console.log(`> Convertendo imagem: ${outputFile}`);
            resolve();
          })

      });
    }
  }

  async function createAllSentences(content) {
    for (let sentenceIndex = 0; sentenceIndex < content.sentences.length; sentenceIndex++) {
      await createSentenceImage(sentenceIndex, content.sentences[sentenceIndex].text);
    }

    async function createSentenceImage(index, text) {
      return new Promise((resolve, reject) => {
        const outputFile = `./content/${index}-sentence.png`;

        const templateSettings = {
          0: {
            size: '1920x400',
            gravity: 'center'
          },
          1: {
            size: '1920x1080',
            gravity: 'center'
          },
          2: {
            size: '800x1080',
            gravity: 'west'
          },
          3: {
            size: '1920x400',
            gravity: 'center'
          },
          4: {
            size: '1920x1080',
            gravity: 'center'
          },
          5: {
            size: '800x1080',
            gravity: 'west'
          },
          6: {
            size: '1920x400',
            gravity: 'center'
          }
        };

        gm()
          .out('-size', templateSettings[index].size)
          .out('-gravity', templateSettings[index].gravity)
          .out('-background', 'transparent')
          .out('-fill', 'white')
          .out('-kerning', '-1')
          .out(`caption:${text}`)
          .write(outputFile, error => {
            if (error) return reject(error);
            console.log(`> Sentence created: ${outputFile}`);
            resolve();
          });
      });
    }
  }

  async function createYouTubeThumbnail() {
    return new Promise((resolve, reject) => {
      gm()
        .in('./content/0-converted.png')
        .write('./content/youtube-thumbnail.jpg', error => {
          if (error) return reject(error);
          console.log('> Creating YouTube Thumbnail');
          resolve();
        });
    });
  }

  async function createAfterEffectsScript(content) {
    await state.saveScript(content);
  }

  async function renderVideoWithNode(content) {
    return new Promise((resolve, reject) => {
      console.log("> Renderizando vídeo...");

      let images = [];

      for (
        let sentenceIndex = 0;
        sentenceIndex < content.sentences.length;
        sentenceIndex++
      ) {
        const sentence = content.sentences[sentenceIndex];
        images.push({
          path: `./content/${sentenceIndex}-converted.png`,
          caption: sentence.text,
          loop: calculateLoopImage(sentence.text.length)
        });
      }

      const videoOptions = {
        fps: 25,
        loop: 5, // seconds
        transition: true,
        transitionDuration: 1, // seconds
        videoBitrate: 1024,
        videoCodec: "libx264",
        size: "640x?",
        audioBitrate: "128k",
        audioChannels: 2,
        format: "mp4",
        pixelFormat: "yuv420p",
        useSubRipSubtitles: false, // Use ASS/SSA subtitles instead
        subtitleStyle: {
          Fontname: "Arial Black",
          Fontsize: "56",
          PrimaryColour: "11861244",
          SecondaryColour: "11861244",
          TertiaryColour: "11861244",
          BackColour: "-2147483640",
          Bold: "1",
          Italic: "0",
          BorderStyle: "2",
          Outline: "2",
          Shadow: "3",
          Alignment: "2", // left, middle, right
          MarginL: "40",
          MarginR: "60",
          MarginV: "40"
        }
      };

      videoshow(images, videoOptions)
        .audio("./templates/1/newsroom.mp3")
        .save("content/output.mp4")
        .on("start", function (command) {
          console.log("> Processo ffmpeg iniciado:", command);
        })
        .on("error", function (err, stdout, stderr) {
          console.error("Error:", err);
          console.error("> ffmpeg stderr:", stderr);
          reject(err);
        })
        .on("end", function (output) {
          console.error("> Video criado:", output);
          resolve();
        });
    });

    function calculateLoopImage(sentenceLength) {
      if (sentenceLength < 100) return 6;
      if (sentenceLength >= 100 && sentenceLength < 150) return 9;
      if (sentenceLength >= 150 && sentenceLength < 200) return 12;
      if (sentenceLength >= 200 && sentenceLength < 250) return 15;
      if (sentenceLength >= 250) return 18;
    }
  }

}

module.exports = robot;