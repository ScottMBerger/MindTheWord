export class ContextMenu {

  constructor(){}

  ifWordCountNotOne(inputString){
      var s = inputString;
      s = s.replace(/(^\s*)|(\s*$)/gi,"");
      s = s.replace(/[ ]{2,}/gi," ");
      s = s.replace(/\n /,"\n");
      if (s.split(' ').length != 1){
          alert('Please select a single word only. Phrases such as: "' + inputString + '" aren\'t allowed');
          return true;
      }
      return false;
  }

  isValid(documentURL) {
      var promise = new Promise(function(resolve, reject) {
        chrome.storage.local.get(['activation', 'blacklist'], function(result) {
          var blacklistWebsiteReg = new RegExp(result.blacklist);
          var activation = result.activation;
          if (activation == false) {
            alert('MindTheWord is switched off\n Please switch it on from the popup menu');
            reject();
          }
          else if (blacklistWebsiteReg.test(documentURL)) {
            alert('Current website is blacklisted\n You can unblacklist the website from the Advanced Settings tab in options');
            reject();
          }
          else {
            resolve();
          }
        })
      })

      return promise;
  }

  searchForSimilarWords(selectedText, searchPlatform, tabURL ) {
    this.isValid(tabURL).then((data) => {
      var searchPlatformURLS = {
        'bing': 'http://www.bing.com/search?q=%s+synonyms&go=&qs=n&sk=&sc=8-9&form=QBLH',
        'google': 'http://www.google.com/#q=%s+synonyms&fp=1',
        'googleImages': 'http://www.google.com/search?num=10&hl=en&site=imghp&tbm=isch&source=hp&q=%s',
        'thesaurus': 'http://www.thesaurus.com/browse/%s?s=t'
      }
      var searchUrl = searchPlatformURLS[searchPlatform];
      selectedText = selectedText.replace(" ", "+");
      searchUrl = searchUrl.replace(/%s/g, selectedText);
      chrome.tabs.create({
         "url":searchUrl
      });
    })
    .catch((data) => {
      //promise rejected
    });
  }

  searchForWordUsageExamples(selectedText, searchPlatform, tabURL) {
    this.isValid(tabURL).then((data) => {
      var searchPlatformURLS = {
        'yourdictionary.com': 'http://sentence.yourdictionary.com/%s',
        'use-in-a-sentence.com': 'http://www.use-in-a-sentence.com/english-words/10000-words/%s.htm',
        'manythings.org': 'http://www.manythings.org/sentences/words/%s/1.html'
      }
      var searchUrl = searchPlatformURLS[searchPlatform];
      selectedText = selectedText.replace(" ", "+");
      searchUrl = searchUrl.replace(/%s/g, selectedText);
      chrome.tabs.create({
         "url":searchUrl
      });
    })
    .catch((data) => {
      //promise rejected
    });
  }

  addUrlToBlacklist(tabURL){
    this.isValid(tabURL).then((data) => {
      var updatedBlacklist;
      chrome.storage.local.get('blacklist', function(result) {
        var currentBlacklist = result.blacklist;
        var blacklistURLs = [];
        blacklistURLs = currentBlacklist.slice(1, -1).split('|');
        var re = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/im;
        var domainNameFromTabURL = tabURL.match(re)[0];
        //to avoid duplication
        updatedBlacklist = '';
        if (blacklistURLs.indexOf(domainNameFromTabURL + '*') == -1) {
          //incase of empty current black list
          if (!currentBlacklist) {
            updatedBlacklist = '(' + domainNameFromTabURL + '*)';
          } else {
            updatedBlacklist = currentBlacklist.split(')')[0] + '|' + domainNameFromTabURL + '*)';
          }
        }
        chrome.storage.local.set({'blacklist': updatedBlacklist});
      });
    })
    .catch((data) => {
      //promise rejected
    });
  }

  addWordToBlacklist(wordToBeBlacklisted, tabURL){

    if (this.ifWordCountNotOne(wordToBeBlacklisted)){
      return;
    }

    this.isValid(tabURL)
    .then((data) => {
      chrome.storage.local.get('userBlacklistedWords', function(result) {
        var currentUserBlacklistedWords = result.userBlacklistedWords;
        var blacklistedWords = [];
        blacklistedWords =  currentUserBlacklistedWords.slice(1,-1).split('|');
        var updatedBlacklistedWords = '';
        //to avoid duplication
        if (blacklistedWords.indexOf(wordToBeBlacklisted) == -1) {
          //incase of empty current black list
          if (!currentUserBlacklistedWords) {
            updatedBlacklistedWords = '(' +  wordToBeBlacklisted + ')';
          } else {
            updatedBlacklistedWords = currentUserBlacklistedWords.split(')')[0] + '|' + wordToBeBlacklisted + ')';
          }
        }
        chrome.storage.local.set({'userBlacklistedWords': updatedBlacklistedWords});
      });
    })
    .catch((data) => {
      //promise rejected
    });
  }

  speakTheWord(utterance, tabURL){
    this.isValid(tabURL).then((data) => {
      chrome.storage.local.get(null, (data) => {
        var playbackOptions = JSON.parse(data.playbackOptions);
        chrome.tts.speak(utterance, {
                voiceName: playbackOptions.voiceName,
                rate: parseFloat(playbackOptions.rate),
                pitch: parseFloat(playbackOptions.pitch),
                volume: parseFloat(playbackOptions.volume),
            }
        );
      });
    })
    .catch((data) => {
      //promise reject
    });
  }

  addToDifficultyBucket(word, difficultyLevel, translatedWords, tabURL){

    if (this.ifWordCountNotOne(word)){return;}

    //to check if the selected word is one of the translated words
    var isTranslatedWord = false;
    for (var k in translatedWords) {
      if (translatedWords[k] === word) {
        isTranslatedWord = true;
        break;
      }
    }

    if (isTranslatedWord){
      this.isValid(tabURL).then((data) => {

        // Hash storage format:
        // format: {targetLanguage: {word1: E/N/H, word2: E/N/H}}
        // E -> easy, N -> normal, H -> hard

        chrome.storage.local.get(['difficultyBuckets','targetLanguage'], function(result) {
          if (result.targetLanguage){
            var currentBuckets = JSON.parse(result.difficultyBuckets);
            var targetLang = result.targetLanguage;
            var targetLangWordBucket = currentBuckets[targetLang];
            var updatedBuckets = currentBuckets;
            if (targetLangWordBucket){
              targetLangWordBucket[word] = difficultyLevel;
            }
            else{
              targetLangWordBucket = {}
              targetLangWordBucket[word] = difficultyLevel;
            }
            updatedBuckets[targetLang] = targetLangWordBucket;
            chrome.storage.local.set({'difficultyBuckets': JSON.stringify(updatedBuckets)});
          }
        });
      }).catch((data) => {
        //promise reject
      });
    }
    else {
        alert('Select one of the translated words');
    }
  }

  markWordAsLearnt(word, translatedWords, tabURL){
    if (this.ifWordCountNotOne(word)){return;}

    //to check if the selected word is one of the translated words
    var isTranslatedWord = false;
    for (var k in translatedWords) {
      if (translatedWords[k] === word) {
        isTranslatedWord = true;
        break;
      }
    }

    if (isTranslatedWord){
      this.isValid(tabURL).then((data) => {
        chrome.storage.local.get(['learntWords'], function(result) {
          var learntWords = result.learntWords;
          var updatedLearntWords = learntWords;
          if (learntWords.length == 2){
            updatedLearntWords = "(" + word + ")";
          }
          else{
            updatedLearntWords = updatedLearntWords.split(")")[0] + "|" + word + ")";
          }
          chrome.storage.local.set({'learntWords': updatedLearntWords});
        });
      })
      .catch((data) => {
        //promise rejected
      })
    }
    else{
      alert('Select one of the translated words');
    }

  }

}