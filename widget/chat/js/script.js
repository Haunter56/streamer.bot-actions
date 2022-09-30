/***************************************************
 *              DO NOT EDIT THIS FILE              *
 *        THIS COULD BREAK YOUR WIDGET OR          *
 * BE A PROBLEM IF YOU WANT TO USE A NEWER VERSION *
 ***************************************************/

// General Variables
var ws;
var dev;
var settings = {
    websocketURL: "ws://localhost:8080/",
    debug: false,
    template: "default",
    blacklist: {
        user: [],
        words: [],
        commands: false,
    },
    animations: {
        animation: true,
        hidedelay: 0,
        hideAnimation: "fadeOut",
        showAnimation: "bounceInRight",
    },
    YouTube: {
        defaultChatColor: "#f20000",
    },
    Twitch: {
        defaultChatColor: "#9147ff",
    },
};

var template_twitch;
var template_youtube;
var template_reward;

/**
 * Storing avatars that have been called to save api calls
 * username: imageURL
 */
var avatars = {};

window.addEventListener("load", (event) => {
    loadTemplates();
    connectws();

    if (settings.debug) {
        console.debug("Debug mode is enabled");
        debugMessages();
    }
});

/**
 * This will load all template,css files in theme/{{themename}}
 * Check console for errors if you theme doesn't work
 */
function loadTemplates() {
    //  Loading message templates
    $("#templates").load(
        `theme/${settings.template}/template.html`,
        function (response, status, xhr) {
            if (status == "error") {
                var msg = "Sorry but there was an error: ";
                console.error(msg + xhr.status + " " + xhr.statusText);
            }
            if (status === "success") {
                // Loading template css
                $("head").append(
                    `<link rel="stylesheet" href="theme/${settings.template}/css/styles.css" type="text/css" />`
                );

                template_twitch = document.querySelector("#message_twitch");
                template_youtube = document.querySelector("#message_youtube");
                template_reward = document.querySelector("#reward");
            }
        }
    );
}

function connectws() {
    if ("WebSocket" in window) {
        console.log("Connecting to Streamer.Bot");
        ws = new WebSocket(settings.websocketURL);
        bindEvents();
    }
}

function bindEvents() {
    ws.onopen = () => {
        ws.send(
            JSON.stringify({
                request: "Subscribe",
                id: "obs-chat",
                events: {
                    general: ["Custom"],
                    Twitch: ["ChatMessage", "ChatMessageDeleted", "RewardRedemption"],
                    YouTube: ["Message", "MessageDeleted", "SuperChat"],
                },
            })
        );
    };

    ws.onmessage = async (event) => {
        const wsdata = JSON.parse(event.data);

        if (wsdata.status == "ok" || wsdata.event.source == null) {
            return;
        }

        // Custom
        if (wsdata.data.name == "ClearChat") {
            ClearChat();
        }


        // Platforms
        console.debug(wsdata.event.source + ": " + wsdata.event.type);

        if (settings.debug) {
            console.debug(wsdata.data);
        }

        message = wsdata.data;

        /* Blacklist */
        // User
        if (settings.blacklist.user.includes(message.displayName)) {
            return;
        }
        // Commands
        if (settings.blacklist.commands == true && message.message.charAt(0) == "!") {
            return;
        }


        switch (wsdata.event.source) {
            case "Twitch":
                switch (wsdata.event.type) {
                    case "ChatMessage":
                        add_message(message.message);
                        break;
                    case "ChatMessageDeleted":
                        hideMessage(message.targetMessageId);
                        break;
                    case "RewardRedemption":
                        add_reward(message);
                        break;
                    default:
                        break;
                }
                break;

            case "YouTube":
                switch (wsdata.event.type) {
                    case "Message":
                        add_YTmessage(wsdata.data);
                        break;
                    case "MessageDeleted":
                        hideMessage(wsdata.data.targetMessageId);
                        break;
                    default:
                        break;
                }
                break;

            default:
                console.error("Could not find Platform: " + wsdata.event.source)
                break;
        }
    };

    ws.onclose = function () {
        setTimeout(connectws, 10000);
    };
}

/**
 * Adding content to message and then render it on screen
 * @param {object} message
 */
async function add_message(message) {

    // Adding time variable
    var today = new Date();
    message.time =
        today.getHours() + ":" + String(today.getMinutes()).padStart(2, "0");

    // Adding default classes
    message.classes = ["msg"];

    const msg = new Promise((resolve, reject) => {
        // Note: This is to prevent a streamer.bot message to not disappear.
        // - This could be a bug and will maybe be removed on a later date.
        if (message.msgId == undefined) {
            console.debug("Message has no ID");
            message.msgId = makeid(6);
        }

        resolve(getProfileImage(message.username));
    })
        .then((avatar) => {
            message.avatar = avatar;
            return renderBadges(message);
        })
        .then((bages) => {
            message.badges = bages;
            return renderEmotes(message);
        })
        .then((msg) => {
            $("#chat").append(renderMessage("Twitch", msg));

            if (settings.animations.hidedelay > 0) {
                hideMessage(message.msgId);
            }
        })
        .catch(function (error) {
            console.error(error);
        });
}

/**
 * Adding content to message and then render it on screen
 * @param {object} message
 */
async function add_YTmessage(message) {
    message.eventId = message.eventId.replace(".", "");

    // Adding time variable
    var today = new Date();
    message.time =
        today.getHours() + ":" + String(today.getMinutes()).padStart(2, "0");

    // Adding default classes
    message.classes = ["msg"];

    const msg = new Promise((resolve, reject) => {
        resolve(message.user.profileImageUrl);
    })
        .then((avatar) => {
            message.avatar = avatar;
            return renderYTEmotes(message);
        })
        .then((msg) => {
            $("#chat").append(renderMessage("YouTube", msg));
        })
        .then((render) => {
            if (settings.animations.hidedelay > 0) {
                hideMessage(message.eventId);
            }
        })
        .catch(function (error) {
            console.error(error);
        });
}

/**
 * Adding content to message and then render it on screen
 * @param {object} reward
 * "id": "9d0911db-7884-4e0f-8cf4-c95c5765c2e5",
 * "dateTime": "2022-01-31T03:10:23.3611616Z",
 * "userId": 0000000000,
 * "userName": "<user name of redeemer>",
 * "displayName": "<display name of redeemer>",
 * "channelId": 0000000, 
 * "cost": 42,
 * "rewardId": "41f257e9-9688-4944-9bf6-28cda1c3fa1f",
 * "title": "Test Reward",
 * "prompt": "",
 * "inputRequired": false,
 * "backgroundColor": "#63D0A9",
 * "enabled": true,
 * "paused": false,
 * "subOnly": false
 * "userInput": "<message>"
 * */
async function add_reward(reward) {

    // Adding time variable
    var today = new Date();
    reward.time =
        today.getHours() + ":" + String(today.getMinutes()).padStart(2, "0");

    reward.msgId = reward.id;
    // Adding userInput if not defined
    if (!message.userInput) {
        message.userInput = "";
    }

    // Adding default classes
    reward.classes = ["msg","reward"];

    const msg = new Promise((resolve, reject) => {

        if (reward.userInput) {
            resolve(renderEmotes(reward));
        }
        resolve(reward);

    }).then((msg) => {
        $("#chat").append(renderMessage("Reward", msg));

        if (settings.animations.hidedelay > 0) {
            hideMessage(reward.msgId);
        }
    }).catch(function (error) {
        console.error(error);
    });
}

/**
 * Render message with template
 * @param {object} message
 * @returns
 */
function renderMessage(platform, message = {}) {
    switch (platform) {
        case "Twitch":
            if (!message.color) {
                message.color = settings.Twitch.defaultChatColor;
            }

            if (message.isHighlighted) {
                message.classes.push("highlight");
            }
            if (message.isReply) {
                message.classes.push("reply");
            }
            if (message.isCustomReward) {
                message.classes.push("reward");
            }
            if (message.isMe) {
                message.classes.push("me");
            }
            if (message.subscriber) {
                message.classes.push("subscriber");
            }
            if (message.role === 4) {
                message.classes.push("broadcaster");
            }
            if (message.role === 3) {
                message.classes.push("moderartor");
            }

            var tpl = template_twitch;

            break;

        case "YouTube":
            // Setting general variabels
            message.displayName = message.user.name;
            message.userId = message.user.id;
            message.msgId = message.eventId;

            message.color = settings.YouTube.defaultChatColor;

            if (message.user.isOwner === true) {
                message.classes.push("owner");
            }
            if (message.user.isModerator === true) {
                message.classes.push("moderator");
            }
            if (message.user.isSponsor === true) {
                message.classes.push("sponsor");
            }
            if (message.user.isVerified === true) {
                message.classes.push("verified");
            }

            var tpl = template_youtube;
            break;

        case "Reward":
            var tpl = template_reward;

            break;


        default:
            break;
    }

    if (settings.animations.animation) {
        message.classes.push("animate__animated");

        if (settings.animations.showAnimation) {
            message.classes.push("animate__" + settings.animations.showAnimation);
        }
    }

    // Blacklist word filter
    if (settings.blacklist.words && platform != "Reward") {
        settings.blacklist.words.forEach((word) => {
            regEx = new RegExp(word, "ig")
            message.message = message.message.replace(regEx, "****");
        });
    }

    message.classes = message.classes.join(" ");

    const pattern = /{{\s*(\w+?)\s*}}/g; // {property}
    return tpl.innerHTML.replace(pattern, (_, token) => message[token] || "");
}

/**
 * Hides a message after an amount of time and deletes it aferwards
 * @param {string} msgId
 */
function hideMessage(msgId) {
    console.log("Hide ID " + msgId + "in " + settings.animations.hidedelay);

    const msg = new Promise((resolve, reject) => {
        delay(settings.animations.hidedelay).then(function () {
            $("#" + msgId).addClass("animate__" + settings.animations.hideAnimation);
            $("#" + msgId).bind("animationend", function () {
                $("#" + msgId).remove();
            });
            resolve();
        });
    }).catch(function (error) {
        console.error(error);
    });
}

/**
 * Creates a markup of all Badges so it can be renderd as one
 * @param {object} message
 * @returns
 */
async function renderBadges(message) {
    var badges = "";

    message.badges.forEach((badge) => {
        badges += `<img class="${badge.name}" title="${badge.name}" src="${badge.imageUrl}">`;
    });

    return badges;
}

/**
 * Swaping Emote names for emote images
 * @param {object} message
 * @returns
 */
async function renderEmotes(message) {
    // Check if Message is emote only
    if (message.message.split(" ").length == message.emotes.length) {
        message.classes.push("emoteonly");
    }

    message.emotes.forEach((emote) => {
        message.message = message.message.replace(
            emote.name,
            `<img class="emote" src="${emote.imageUrl}">`
        );
    });

    return message;
}

/**
 * Swaping Emote names for emote images
 * @param {object} message
 * @returns
 */
async function renderYTEmotes(message) {
    // Todo: Find a way to get Emotes https://github.com/BlackyWhoElse/streamer.bot-actions/issues/56
    return message;
}

/**
 * Calling decapi.me to recive avatar link as string
 * @param {string} username
 * @returns
 */
async function getProfileImage(username) {
    // Check if avatar is already stored
    if (avatars.username) {
        return avatars.username;
    }

    return fetch(`https://decapi.me/twitch/avatar/${username}`)
        .then((response) => {
            return response.text();
        })
        .then((avatar) => {
            avatars[username] = avatar;
            return avatar;
        });
}

// Command Code
function ClearChat() {
    $("#chat").html("");
}

// Helper Code
function delay(t, v) {
    return new Promise(function (resolve) {
        setTimeout(resolve.bind(null, v), t);
    });
}

// Debug Code
function debugMessages() {

    dev = setInterval(() => {
        let sub = false;
        let r = Math.floor(Math.random() * (4 - 1 + 1) + 1)

        if (Math.random() == 1) sub = true;

        const message = {
            avatar: "https://static-cdn.jtvnw.net/jtv_user_pictures/a88dd690-f653-435e-ae3f-cd312ee5b736-profile_image-300x300.png",
            bits: 0,
            badges: [{
                imageUrl: "https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/3",
                name: "broadcaster",
            },
            {
                imageUrl: "https://static-cdn.jtvnw.net/badges/v1/31966bdb-b183-47a9-a691-7d50b276fc3a/3",
                name: "subscriber",
            },
            ],
            emotes: [],
            channel: "blackywersonst",
            color: "#B33B19",
            displayName: "Blackywersonst",
            firstMessage: false,
            hasBits: false,
            internal: false,
            isAnonymous: false,
            isCustomReward: false,
            isHighlighted: false,
            isMe: false,
            isReply: false,
            message: randomMessage(),
            monthsSubscribed: 57,
            msgId: makeid(12),
            role: r,
            subscriber: sub,
            userId: 27638012,
            username: "blackywersonst",
            time: "19:36",
        };

        add_message(message);
    }, 4000);
}

function makeid(length) {
    var result = "";
    var characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function randomMessage() {

    msgs = [
        "Welcome",
        "If you ate pasta and antipasta, would you still be hungry?",
        "go on",
        "Oh goodness bunch of sensitive cry babies on twitter!",
        "tell me more",
        "you will be part of it all",
        "Would be, cause Im asking",
        "ask and I will tell",
        "meaning?",
        "Now I am interested, go on",
        "you will be next week",
        "I see you find yourself very interesting",
        "Hi how are you?",
        "I am fantastic and feeling astonishingly glorious",
        "What did you want to be when you grew up?",
        "I feel like I am taking crazy pills!",
        "maybe you are",
        "Sometimes I am",
        "Go on",
        "I drink diced kitten to make other people more interesting",
        "Go on",
        "Is there a spell to become a mermaid that actually works?",
        "Love Spell - To write a successful love letter, rub the entire sheet of stationary with lavender before you start writing",
        "Greetings",
        "hello",
        "wazzup",
        "Which common saying or phrase describes you?",
        "the one on the left",
        "Is the game really over?",
        "Not that there's anything wrong with that",
        "You smell different when you're awake",
        "When a clock is hungry it goes back four seconds",
        "tommorow",
        " Would you rather have one real get out of jail free card or a key that opens any door?",
        "you like yourself alot right",
    ];

    msg = msgs[Math.floor(Math.random() * msgs.length)]

    return msg;
}