var statusForModal = null
var taken_coupon_code = false
const backendBaseURL =  "https://eql-extension-backend.herokuapp.com/" 

self.importScripts(chrome.runtime.getURL("res/firebase-compat.js"));

const initExtension = async () => {
    return fetch(backendBaseURL + 'api/init-extension')
    .then((res) => {return res.json()})
    .then((res) => {
        
        return chrome.cookies.set({httpOnly: true, secure: true, url: backendBaseURL, name:"eql_strapi_jwt", value: res.jwt})
        .then((cookie) => {
            if(!chrome.runtime.lastError){
                const app = firebase.initializeApp(res.config);
                var defaultAuth = firebase.auth();
                return true
            }else{
                console.log(chrome.runtime.lastError)
                return false
            }
        })

    })
    .catch((err) => {
        console.log("Error on init extension", err)
        return false
    })
}


chrome.runtime.onInstalled.addListener((details) => {
    initExtension().then((result) => {
        if(result){
            console.log("Extension initialized")
            chrome.tabs.onUpdated.addListener(onStoreListener)
    
            chrome.tabs.create({
                url: chrome.runtime.getURL('post-download-upgrade.html')
            })
        }else{
            //The server is down or something catastrophic
        }
        
    })
});

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
    return chrome.cookies.get({url: backendBaseURL, name:"eql_user_member_key"})
        .then((cookie) => {
            if(cookie && cookie.value){
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
                        return user.getIdToken(true).then((token) => {
                            return token
                        })
                    }else{
                        return null
                    }
                }).then((token) => {
                    if(!token){
                        return null
                    }else{
                        return chrome.cookies.set({httpOnly: true, secure: true, url: backendBaseURL, name:"eql_firebase_id", value: token})
                        .then((cookie) =>{
                            return fetch(backendBaseURL + "api/eql-login")
                            .then((res) => {
                                return res.json()
                            }).catch((err) => {
                                return null
                            })
                        })
                    }
                }).then(async (json) => {
                    if(json && json.access_token){
                        await chrome.cookies.remove({url: backendBaseURL, name:"eql_firebase_id"})
                        let user_member_key = json.user_id.split('-').join('').toLowerCase()

                        return chrome.cookies.set({httpOnly: true, secure: true, url: backendBaseURL, name:"eql_user_member_key", value: user_member_key})
                            .then((cookie) => {
                                if(chrome.runtime.lastError){
                                    return false
                                }else{
                                    return true
                                }
                            })
                    }else{
                        console.log("ERR:", json)
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
        })
}

const searchAPIRequest = async (url) => {
    if(!url){
        return []
    }else{
        return fetch(backendBaseURL + "api/domains?search=" + url)
        .then((res) => {
            if(res.status == 403 || res.status == 401){
                initExtension().then((result) => {
                    if(result){
                        return searchAPIRequest(url)
                    }else{
                        console.log("Error on search api request reinit ")
                        return []
                    }
                })
            }

            return res.json()
        }).catch((err) => {
            console.log("Error on search api request ", err)
            return []
        })
    }
}

const getOffersForUser = (url) => {
    return searchAPIRequest(url).then(async (offers) => {
        return chrome.cookies.get({url: backendBaseURL, name:"eql_user_member_key"})
        .then(async (cookie) => {
            let userCaRedeem = []

            for (const offer of offers){
                await fetch(backendBaseURL + "api/uses-remaining?" + new URLSearchParams({
                    offerKey: offer.offer_key,
                    memberKey: cookie.value
                }))
                .then((res) => {return res.json()})
                .then(async (redeemData) => {
                    if((redeemData.message && redeemData.status == 200) ||
                        (redeemData.offers && redeemData.offers[0].offer_uses_remaining.usable)){
                        return true
                    }else{
                        return false
                    }
                }).then((can) => {
                    if(can) userCaRedeem.push(offer)
                })
            }
            return userCaRedeem
        })

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
        }).catch((err) => console.log(err));
    })
}

const getStoreName = async () => {
    return chrome.tabs.query({active: true})
    .then((tabs) => {
        let url = tabs[0].url
        if(url.startsWith("chrome://")){
            return "site"
        }

        try {
            let storeName = url.match(/(?:http|https)\:\/\/(?:www\.)?(?:(?:[a-zA-z0-9\-]*\.)*)(([a-zA-z0-9\-]*)\.[a-z]{2,3})/)[2]
            return storeName
        } catch (error) {
            return "site"
        }
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

const userRedeemOffer = async (offer, reInitOnFail) => {
    
    if(!offer){
        return false
    }
    
    return chrome.storage.sync.set({offer: null, storeName: null}).then(() => {
        return chrome.cookies.get({url: backendBaseURL, name:"eql_user_member_key"})
        .then((cookie) => {
            if(cookie.value){
                return fetch(backendBaseURL + "api/offer-redeem?" + new URLSearchParams({
                        offerKey: offer.offer_key,
                        memberKey: cookie.value
                })).then(async (res) => {
                    if((res.status == 403 || res.status == 401) && reInitOnFail){
                        initExtension().then((result) => {
                            if(result){
                                userRedeemOffer(offer, false)
                            }
                        })
                    }

                    if(res.message){
                        //This means it didn't work
                        return false
                    }else{
                        //It worked
                        return true
                    }
                })
            }else{
                return false
            }
        })
    })
}

const navigationsOnDomain = {dom: "", navs: 0}
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
                    if((selectedOfferData.offer && selectedOfferData.offer.code) && (selectedOfferStoreName.storeName == currentStoreName) && changeInfo.status == "complete"){
                        chrome.scripting.executeScript({
                            target: {tabId: newTab.id},
                            func: offerCodeEntry,
                            args: [selectedOfferData.offer.code]
                        }).then((injectionResults) => {
                            return injectionResults[0].result
                        }).then((codeEntryFailed) => {
                            if(codeEntryFailed){
                                //TODO: If this didnt work then tell the user the code is copied and to insert manually
                                //statusForModal = `We had trouble applying your offer. <br> Please enter code ${selectedOfferData.code} at checkout!` 
                            }else{
                                userRedeemOffer(selectedOfferData, true)
                            }
                        })
                    }else{
                        
                    }
                    
                })
            })
        })
    })
    .catch((err) => {
        
    })
}

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
        .then(async (url) => {
            return await getOffersForUser(url)
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
    }else if(req.email){
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
        chrome.cookies.get({url: backendBaseURL, name:"eql_user_member_key"})
        .then((cookie) => {
            sendResponse(cookie != null)
        })
    }else if(req == "logout"){
        chrome.cookies.remove({url: backendBaseURL, name:"eql_user_member_key"})
    }
    else if(req.resetEmail){
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
                userRedeemOffer(req.selectedOffer, true)
                .then((res) => {
                    if(res){
                        sendResponse({title: "Offer applied successfully!", sub:"Code: | copied to your clipboard just in case."})
                    }
                    else{
                        sendResponse({title: "Code: | copied to your clipboard!", sub:"You will have to paste code on checkout."})
                    }
                })
            }
        })
        .catch((error) => {
            sendResponse({title: "Error on code application.", sub:"Code: | copied to your clipboard."})
        });

    }
    
    return true;
})


chrome.history.onVisited.addListener(
    function(result){
        
    }
)

