const loginFormDiv = document.getElementById('login-form')
const loginFormActual = document.getElementById('login-form-actual')
const forgotForm = document.getElementById('forgot-form-div')
const communityTab = document.getElementById('community-info')
const postLogin = document.getElementById('post-login')


const postDownloadSwitchState = (which) => {
    switch (which) {
        case "login":
            loginFormDiv.style.display = 'flex'
            forgotForm.style.display = 'none'
            communityTab.style.display = 'flex'
            postLogin.style.display = 'none'
            break;
        case "logged in":
            loginFormDiv.style.display = 'none'
            forgotForm.style.display = 'none'
            communityTab.style.display = 'none'
            postLogin.style.display = 'flex'
            break;
        case "forgot":
            loginFormDiv.style.display = 'none'
            forgotForm.style.display = 'flex'
            communityTab.style.display = 'flex'
            postLogin.style.display = 'none'
            break;
    }
}


inputs = document.getElementsByClassName('inputholder')
for(var i = 0; i < inputs.length; i++){
    input = inputs[i]
    input.addEventListener('click', (e) => {
        if(e.target.nodeName != "INPUT"){
            input = e.target.querySelector('input')
            input.focus()
        }
    })
}

loginFormActual.addEventListener('submit', (e) => {
    e.preventDefault()
    let email = loginFormActual.elements['email'].value
    let password = loginFormActual.elements['password'].value

    chrome.runtime.sendMessage({email:email, password:password}, (response) => {
        
        if(response == 'mk'){
            document.getElementsByClassName('incorrect')[0].style.display = 'none'

            document.getElementById('pwDiv').style.borderColor = "#BDBDBE"
            document.getElementById('pwText').style.color = "#3D3E3F"

            postDownloadSwitchState("logged in")
        }else{
            document.getElementsByClassName('incorrect')[0].style.display = 'block'

            document.getElementById('pwDiv').style.borderColor = "#c51717"
            document.getElementById('pwText').style.color = "#c51717"
        }
    })
})

document.getElementById("eye")?.addEventListener('click', () => {
    let field = document.getElementsByClassName('input')[1]
    let eye = document.getElementById("eye")
    let type = field.getAttribute('type')

    if(type == 'password'){
        field.setAttribute('type', 'text')
        eye.setAttribute('src', './res/images/eye-2.png')
    }else{
        field.setAttribute('type', 'password')
        eye.setAttribute('src', './res/images/eye-1.png')
    }
})


document.getElementById("forgot").addEventListener('click', () => {
    postDownloadSwitchState('forgot')
})
document.getElementById("forgot-back").addEventListener('click', () => {
    postDownloadSwitchState('login')
})
document.getElementById("forgotForm")?.addEventListener('submit', (e) => {
    let email = document.getElementById('forgotForm').elements['email'].value

    chrome.runtime.sendMessage({resetEmail:email}, (response) => {
        if(response == null){
            document.getElementById('check').style.visibility = 'visible'
            document.getElementById('status2').style.display = 'none'
            document.getElementById('resetEmail').style.borderColor = "#1ABB1C"
        }else{
            document.getElementById('resetEmail').style.borderColor = "#c51717"
            document.getElementById('status2').style.display = 'flex'
            document.getElementById('resetErrorText').style.display = 'block'
            document.getElementById('resetErrorText').innerHTML = "Email invalid or other error"
        }
    })

    e.preventDefault()
})

document.getElementById('signup').addEventListener('click', () => {
    chrome.tabs.create({url: "https://www.eqlcash.com/authentication/sign-up"})
})

window.onload = () => {

    const divMaxHeight = 387
    const instructionDiv = document.getElementById("instruction-div")
    instructionDiv.focus()
    var prevHeight = instructionDiv.clientHeight
    var percentage = Math.floor((prevHeight/divMaxHeight) * 100)
    document.getElementById("scrollbar-item").style["backgroundImage"] = `linear-gradient(180deg, #2EA683 ${percentage}%, #BDBDBD ${100-percentage}%)`

    var heightReached = [false, false]
    instructionDiv.addEventListener("scroll", (ev) => {
        
        instructionDiv.style.height =  (prevHeight <= divMaxHeight ? prevHeight + parseInt(ev.target.scrollTop) : divMaxHeight) + "px"
        prevHeight += ev.target.scrollTop

        if(prevHeight > (divMaxHeight/3) + 100 && !heightReached[0]){
            document.getElementById('i2').style.visibility = "visible"
            document.getElementById('i1').style.color = "#787878"
            document.getElementById('inst-pic').src = "./res/images/State_AboutToClickCode2.png"
            heightReached[0] = true
        }
        if(prevHeight > (divMaxHeight*2/3) + 100 && !heightReached[1]){
            document.getElementById('i3').style.visibility = "visible"
            document.getElementById('i2').style.color = "#787878"
            document.getElementById('inst-pic').src = "./res/images/State_Clicked.png"
            heightReached[1] = true
        }

        percentage = Math.floor((prevHeight/divMaxHeight) * 100)
        document.getElementById("scrollbar-item").style["backgroundImage"] = `linear-gradient(180deg, #2EA683 ${percentage}%, #BDBDBD ${100-percentage}%)`
        
        ev.target.scrollTop = 0
    })

    window.onscroll = (ev) => {
        instructionDiv.focus()
        instructionDiv.scroll({top: instructionDiv.clientHeight + 5})
    }
    document.getElementById('instruction-div-holder').onmouseenter = () => {

        instructionDiv.scroll({top: 100})
    }
}


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

chrome.runtime.sendMessage('logged in', (response) => {
    if(response){
        postDownloadSwitchState('logged in')
    }else{
        postDownloadSwitchState('login')
    }
})