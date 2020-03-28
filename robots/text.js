const algorithmia = require('algorithmia');
const algorithmiaApiKey = require('../credentials/algorithmia.json').apiKey;
const sentenceBoundaryDetection = require('sbd');

const watsonApiKey = require('../credentials/watson-nlu.json').apikey;
const watsonUrl = require('../credentials/watson-nlu.json').url;
const NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1');

const nlu = new NaturalLanguageUnderstandingV1({
  iam_apikey: watsonApiKey,
  version: '2018-04-05',
  url: watsonUrl
});

const state = require('./state');

async function robot() {
  const content = state.load();

  await fetchContentFromWikipedia(content);
  sanitizeContent(content);
  breakContentIntoSentences(content);
  limitMaximumSentences(content);
  await fetchKeyWordsOfAllSentences(content);

  state.save(content);

  async function fetchContentFromWikipedia(content) {
    console.log("Buscando conteúdo na internet...");
    const algorithmiaAuthenticated = algorithmia(algorithmiaApiKey);
    const wikipediaAlgorithm = algorithmiaAuthenticated.algo('web/WikipediaParser/0.1.2');
    const wikipediaResponse = await wikipediaAlgorithm.pipe({
      "articleName": content.searchTerm,
      "lang": "pt"
    });
    const wikipediaContent = wikipediaResponse.get();

    content.sourceContentOriginal = wikipediaContent.content;
    console.log("Busca realizada com sucesso!");
  }

  function sanitizeContent(content) {
    console.log("Formatando conteúdo...")
    const withoutBlankLinesAndMarkdown = removeBlankLinesAndMarkdown(content.sourceContentOriginal);
    const withoutDatesInParentheses = removeDatesInParentheses(withoutBlankLinesAndMarkdown);
    
    content.sourceContentSanitized = withoutDatesInParentheses;

    console.log("Conteúdo formatado com sucesso!")

    function removeBlankLinesAndMarkdown(text) {
      const allLines = text.split("\n");
      const withoutBlankLinesAndMarkdown = allLines.filter(line => {
        if(line.trim().length === 0 || line.trim().startsWith('=')) {
          return false;
        }
        return true;
      });
      return withoutBlankLinesAndMarkdown.join(' ');
    }

    function removeDatesInParentheses(text) {
      return text.replace(/\((?:\([^()]*\)|[^()])*\)/gm, '').replace(/  /g, ' ');
    }

  }

  function breakContentIntoSentences(content) {
    console.log("Resumindo conteúdo em tópicos...")
    content.sentences = [];

    const sentences = sentenceBoundaryDetection.sentences(content.sourceContentSanitized);
    sentences.forEach(sentence => {
      content.sentences.push({
        text: sentence,
        keywords: [],
        images: []
      });
    });
  }

  function limitMaximumSentences(content) {
    content.sentences = content.sentences.slice(0, content.maximumSentences);
  }

  async function fetchKeyWordsOfAllSentences(content) {
    console.log("Detectando as palavras-chave");
    for(const sentence of content.sentences) {
      sentence.keywords = await fetchWatsonAndReturnKeywords(sentence.text);
    }
  }

  async function fetchWatsonAndReturnKeywords(sentence) {
    return new Promise((resolve, reject) => {
      nlu.analyze({
        text: sentence,
        features: {
          keywords: {}
        }
      }, (error, response) => {
        if (error) throw error;

        const keywords = response.keywords.map(keyword => {
          return keyword.text;
        });

        resolve(keywords);
      });
    });
  }

}

module.exports = robot;