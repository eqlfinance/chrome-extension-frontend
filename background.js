var jwt = ''
var statusForModal = null
var taken_coupon_code = false
const backendBaseURL =  "https://eql-extension-backend.herokuapp.com/" 

self.importScripts(chrome.runtime.getURL("res/firebase-compat.js"));

const initExtension = async () => {
    await fetch(backendBaseURL + 'api/init-extension')
    .then((res) => {return res.json()})
    .then((res) => {
        jwt = res.jwt
        
        console.log("got for config", res)

        const app = firebase.initializeApp(res.config);
        var defaultAuth = firebase.auth();
    })
    .catch((err) => {
        console.log(err)
    })
}

chrome.runtime.onInstalled.addListener((details) => {
    chrome.tabs.create({
        url: chrome.runtime.getURL('post-download.html')
    })
});
initExtension().then(() => {
    console.log("Extension initialized")
})

function readFromChromeStorage(key) {
    return new Promise((resolve, reject) => {
        if (key != null) {
            chrome.storage.sync.get(key, function (obj) {
                resolve(obj);
            });
        } else {
            reject(null);
        }
    });
}

const loginToEQL = async (userDetails) => {
    let member_key = await readFromChromeStorage("member_key")
    
    if(member_key.member_key){
        return true
    }else{
        return firebase.auth().signInWithEmailAndPassword(userDetails.email, userDetails.password)
            .then((userCredential) => {
                // Signed in
                var user = userCredential.user;
                return user
            })
            .then(async (user) => {
                if(user){
                    return chrome.storage.sync.set({email: user.email, member_key: user.uid})
                    .then(() => {
                        return user.getIdToken(true)
                    })
                    .then((token) => {
                        return token
                    })
                    .catch((err) => {
                        console.log("Error on token getting", err)
                        return null
                    })
                }else{
                    return null
                }
            }).then((token) => {
                if(!token){
                    return null
                }else{
                    return fetch(backendBaseURL + "api/eql-login?" + new URLSearchParams({idToken:token}))
                    .then((res) => {
                        return res.json()
                    }).catch((err) => {
                        return null
                    })
                }
            }).then(async (json) => {
                console.log(json)
                if(json && json.access_token){
                    let additional = json.user_id.split('-').join('').toLowerCase()

                    chrome.storage.sync.get('member_key', (results) => {
                        chrome.storage.sync.set({member_key: results.member_key.toLowerCase() + additional}, () => {})
                    })

                    return true
                }else{
                    console.log("Instead of json got", json)
                    return false
                }
            })
            .catch((error) => {
                var errorCode = error.code;
                var errorMessage = error.message;

                console.log(error)
                return false
            });
    }
}

// const accessAPIVerify = async () => {
//     let member_key = await readFromChromeStorage("member_key")

//     fetch('https://amt-stage.accessdevelopment.com/api/v1/imports')
// }

const searchAPIRequest = async (url) => {
    if(!url){
        return []
    }else{      
        return fetch(backendBaseURL + "api/domains?search=" + url, {
            headers: {
                Authorization:'Bearer ' + jwt,
            },
        })
        .then((res) => {
            return res.json()
        }).catch((err) => {
            return []
        })
    }
}

const getOffersForUser = (url) => {
    return searchAPIRequest(url).then(async (offers) => {
        console.log("Got offers", offers, "from domain", url)
        let userCaRedeem = []

        let member_key = await readFromChromeStorage("member_key").member_key

        for (const offer of offers){
            await fetch(`https://offer.adcrws.com/v1/offers/${offer.offer_key}/uses_remaining?` + new URLSearchParams({
                access_token: "1e1ae19df5f302cc310a740363ca8e69722136af6c669cb970a8b6ea23582d26",
                member_key: member_key
            })).then(async (res) => {
                //Inside redeemData is the stats for this user's use of this offer
                let redeemData = await res.json()
    
                if((redeemData.message && redeemData.status == 200) || 
                    (redeemData.offers && redeemData.offers.offers_uses_remaining.usable)){
    
                    userCaRedeem.push(offer)
                }
            })
        }
        return userCaRedeem
    })
}

const loadFonts = () => {
    const fonts = [
        new FontFace('Gilroy-Bold', `url(${chrome.runtime.getURL('./res/font/Gilroy-Bold.ttf')})`),
        new FontFace('Gilroy-Medium', `url(${chrome.runtime.getURL('./res/font/Gilroy-Medium.ttf')})`),
        new FontFace('Gilroy-SemiBold', `url(${chrome.runtime.getURL('./res/font/Gilroy-SemiBold.ttf')})`)
    ]
    
    fonts.forEach((font) => {
        font.load().then((f) => {
            document.fonts.add(f);
            console.log('Font loaded')
        }).catch((err) => console.log(err));
    })
}

const getStoreName = async () => {
    return chrome.tabs.query({active: true})
    .then((tabs) => {
        let url = tabs[0].url
        let storeName = url.match(/(?:http|https)\:\/\/(?:www\.)?(?:(?:[a-zA-z0-9\-]*\.)*)(([a-zA-z0-9\-]*)\.[a-z]{2,3})/)[2]
        console.log("store name: ", storeName)
        return storeName
    }) 
}


const offerCodeEntry = (code) => {
    var inputs = document.querySelectorAll("input[type=text]");
    var buttons = document.querySelectorAll("input[type=button], button");
    var selectedInput = null
    var selectedButton = null
    const inputMatchString = /\b(discount|coupon|offer|promo)/

    const findKeywordInElement = (element) => {
        if(element.innerHTML.toLowerCase().match(inputMatchString)){
            return true
        }

        let attributes = Array.from(element.attributes)

        for (let index2 = 0; index2 < attributes.length; index2++) {
            const attr = attributes[index2];

            if(attr.nodeName.toLowerCase().match(inputMatchString) != null ||
            attr.nodeValue.toLowerCase().match(inputMatchString) != null){
                return true
            }
        }

        return false
    }

    const searchThisAndChildren = (element) => {
        if(findKeywordInElement(element)){
            return true
        }else{
            console.log(element, element.innerHTML)
            for (let index = 0; index < element.children.length; index++) {
                const child = element.children[index];
                if(findKeywordInElement(child)){
                    return true
                }
            }


            return false
        }
    }

    for (let index = 0; index < inputs.length; index++) {
        const input = inputs[index];
        
        if(input){
            if(searchThisAndChildren(input)){
                selectedInput = input;
                input.setAttribute('value', code)
                input.value = code
    
                input.dispatchEvent(new Event('input', {bubbles: true, cancelable: false, composed:true}))
                input.dispatchEvent(new Event('blur', {bubbles: true, cancelable: false, composed:true}))
                break;
            }
        }

        if(selectedInput) break;
    }

    if(!selectedInput){
        return 1
    }else{
        for (let index = 0; index < buttons.length; index++) {
            const button = buttons[index];
            
            if(button){
                if(searchThisAndChildren(button)){
                    selectedButton = button;
                    button.click()
                    break;
                }
            }
    
            if(selectedButton) break;
        }

        if(!selectedButton){
            return 2
        }
    }

    return null
}

const userRedeemOffer = async (offer) => {
    
    if(!offer){
        return
    }
    
    chrome.storage.sync.set({offer: null, storeName: null}).then(() => {
        readFromChromeStorage('member_key').then((obj) => {
            if(obj.member_key){
                fetch(backendBaseURL + "api/offerRedeem?" + new URLSearchParams({
                        offerKey: offer.offer_key,
                        memberKey: obj.member_key
                        //TODO: Get first name/last name
                })).then(async (res) => {
                    //Inside redeemData is the stats for this user's use of this offer
                    if(res.message){
                        //This means it didn't work
                    }else{
                        //It worked
                    }
                })
            }
        })
    })
}

const navigationsOnDomain = {dom: "", navs: 0}
//chrome.tabs.onUpdated.addListener(onStoreListener)
const onStoreListener = (tabId, changeInfo, newTab) => { 
    
    //TODO: Maybe a more custom approach instead chopping the whole website off
    getStoreName().then((domain) => {
        if(!newTab.active || newTab.url.startsWith("chrome")){
            throw "Reject 1 " + !newTab.active + " " + newTab.url.startsWith("chrome")
        }

        if(!newTab.url.includes(domain)){
            throw "This tab is not the store one"
        }

        if(navigationsOnDomain.dom == domain){
            if(changeInfo.status == "complete")
                navigationsOnDomain.navs++
        }else{
            navigationsOnDomain.dom = domain
            navigationsOnDomain.navs = 0

            throw "Navigation domain didn't match previous"
        }

        if(navigationsOnDomain.navs < 1){
            throw "Not enough navigations on this domain"
        }
    }).then(() => {
        readFromChromeStorage('offer').then((selectedOfferData) => {
            readFromChromeStorage('storeName').then((selectedOfferStoreName) => {
                getStoreName().then((currentStoreName) => {
                    //console.log(selectedOfferData, selectedOfferStoreName, currentStoreName)
                    if((selectedOfferData.offer && selectedOfferData.offer.code) && selectedOfferStoreName.storeName == currentStoreName){
                        chrome.scripting.executeScript({
                            target: {tabId: newTab.id},
                            func: offerCodeEntry,
                            args: [selectedOfferData.offer.code]
                        }).then((injectionResults) => {
                            return injectionResults[0].result
                        }).then((codeEntryFailed) => {
                            console.log(codeEntryFailed)
                            if(codeEntryFailed){
                                //TODO: If this didnt work then tell the user the code is copied and to insert manually
                                statusForModal = `We had trouble applying your offer. <br> Please enter code ${selectedOfferData.code} at checkout!` 
                            }else{
                                userRedeemOffer(selectedOfferData)
                            }
                        })
                    }else{
                        //TODO: Clear the offer and store name because they left the page?
                        //      The checkout page name could be different
                        //console.log("Suspicious redeem of offer", selectedOfferData, selectedOfferStoreName.storeName, currentStoreName)
                        //userRedeemOffer(selectedOfferData)
                    }
                    
                })
            })
        })
    }).then(() => {
        if(navigationsOnDomain.navs > 2 && changeInfo.status == "complete"){
            chrome.scripting.executeScript({
                target: {tabId: newTab.id},
                files: ['modal.js'],
            })
        }
    })
    .catch((err) => {
        console.log("Chrome listener error:", err)
    })
}
chrome.tabs.onUpdated.addListener(onStoreListener)

chrome.runtime.onMessage.addListener((req,sender,sendResponse) => {
    if(req == "offers"){
        chrome.tabs.query({active: true}) 
        .then((tabs) => {
            if(tabs){
                var tab = tabs[0]
                if(tab.url.startsWith("chrome://")){
                    return null
                }else{
                    return tab.url
                }
            }
            else{
                return null
            }
        })
        .then((url) => {
            return getOffersForUser(url)
        })
        .then((data) => {
            //CUSTOMER TOUCH POINT: They requested offers (inside data) at the domain in tab.url
            sendResponse(data)
            return true;
        })
        .catch((err) => {
            sendResponse([])
            return true;
        })
    }else if(req?.email){
        loginToEQL(req)
        .then((loggedIn) => {
            if(loggedIn){
                sendResponse('mk')
            }else{
                sendResponse(null)
            }
        }).catch((err) => {
            sendResponse(null)
        })
        
        return true;
    }else if(req == 'logged in'){
        readFromChromeStorage("member_key").then((result) => {
            sendResponse(result.member_key);
        })
    }else if(req.resetEmail){
        firebase.auth().sendPasswordResetEmail(req.resetEmail)
        .then(() => {
            sendResponse(null)
        })
        .catch((error) => {

            sendResponse(1)
        });
    }else if(req == 'store name'){
        getStoreName().then((name) => {
            sendResponse(name)
        })
    }else if(req.selectedOffer){
        getStoreName().then((name) => {
            chrome.storage.sync.set({offer:req.selectedOffer, storeName:name})
        }).then(() => {
            return chrome.tabs.query({active: true}).then((tabs) => {return tabs[0]})
            .then((tab) => {
                return chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    func: offerCodeEntry,
                    args: [req.selectedOffer.code]
                }).then((injectionResults) => {
                    return injectionResults[0].result
                })
            })
        })
        .then((codeEntryFailed) => {
            if(codeEntryFailed){
                sendResponse({title: "Code: | copied to your clipboard!", sub:"You will have to paste code on checkout."})
            }else{
                userRedeemOffer(req.selectedOffer)
                sendResponse({title: "Offer applied successfully!", sub:"Code: | copied to your clipboard just in case."})
            }
        })
        .catch((error) => {
            sendResponse({title: "Error on code application.", sub:"Code: | copied to your clipboard."})
        });

    }else if(req == "status for modal"){
        let status = statusForModal
        statusForModal = null
        sendResponse(status)
    }
    
    return true;
})


chrome.history.onVisited.addListener(
    function(result){
        
    }
)

