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

const loginform = document.getElementById('login-inst-panel')
const b4s = document.getElementsByClassName('b4')
const tu2 = document.getElementById('tu2')
const instructions = document.getElementById('insts')

const postDownloadSwitchState = (state) => {
    switch (state) {
        case "login":
            loginform.style.display = 'flex'
            for (let index = 0; index < b4s.length; index++) {
                const element = b4s[index];
                element.style.display = 'block'
            }
            instructions.style.display = 'none'
            break;
        case "post login":
            loginform.style.display = 'none'
            for (let index = 0; index < b4s.length; index++) {
                const element = b4s[index];
                element.style.display = 'none'
            }
            tu2.style.display = 'block'
            instructions.style.display = 'flex'
            break;
        default:
            break;
    }
}


loginform.addEventListener('submit', (e) => {
    let email = document.getElementById('loginForm').elements['email'].value
    let password = document.getElementById('loginForm').elements['password'].value

    chrome.runtime.sendMessage({email:email, password:password}, (response) => {
        
        if(response == 'mk'){
            document.getElementById('status').className = 'underfields'
            document.getElementsByClassName('incorrect')[0].style.display = 'none'

            document.getElementById('pwDiv').style.borderColor = "#BDBDBE"
            document.getElementById('pwText').style.color = "#3D3E3F"

            postDownloadSwitchState("post login")
        }else{
            document.getElementById('status').className = 'underfields2'
            document.getElementsByClassName('incorrect')[0].style.display = 'block'

            document.getElementById('pwDiv').style.borderColor = "#c51717"
            document.getElementById('pwText').style.color = "#c51717"
        }
    })

    e.preventDefault()
})

document.getElementById('signup').addEventListener('click', () => {
    chrome.tabs.create({url: "https://www.eqlcash.com/authentication/sign-up"})
})

chrome.runtime.sendMessage('logged in', (response) => {
    if(response){
        postDownloadSwitchState('post login')
    }else{
        postDownloadSwitchState('login')
    }
})