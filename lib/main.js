/* Simple Gmail Counter – Firefox Add-On
Copyright (C) 2015 Myles V. Barros

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>. */

// SDK resource imports
const { ActionButton } = require("sdk/ui/button/action");
const panels = require("sdk/panel");
const sprefs = require("sdk/simple-prefs");
const tabs = require("sdk/tabs");
const { setInterval, clearInterval } = require("sdk/timers");
const xhr = require("sdk/net/xhr");

// Project constants
const gmailAddress = "https://mail.google.com";
const feedAddress = "https://mail.google.com/mail/feed/atom";
const standardUpdateFreq = 5400;
const longUpdateFreq = 32000;

// Project variables 
let signinState = 1;
// The Gmail RSS API oddly rejects access with a 401 periodically. At present behavior seems
// non-deterministic and so we will attempt to request the feed twice before determining that
// the user is not in fact logged in.
let numTries = 0;
let connectionAttempts = 0;
let primaryColor = "#186DEE";
let intervalID;

let button = ActionButton({
	id: "gmail-link",
	label: "Gmail Counter",
	icon: {
		"16": "./icon-16.png",
		"32": "./icon-32.png",
		"64": "./icon-64.png"
	},
	onClick: handleButtonClick,
	badgeColor: primaryColor
});

let panel = panels.Panel({
	contentURL: "./signin-panel.html",
	contentScriptFile: "./signin-content-script.js",
	position: button,
	width: 240,
	height: 128
});

function handleButtonClick(state) {
	let activeTabURL = tabs.activeTab.url;
	if (activeTabURL === "about:newtab" || activeTabURL === "about:blank") {
		tabs.activeTab.url = gmailAddress;
	}
	else {
		tabs.open(gmailAddress);
	}
}

function onColorChange() {
	primaryColor = sprefs.prefs.color;
	button.badgeColor = primaryColor;
	panel.port.emit("color", primaryColor);
}

function setEmailCount(newCount) {
	if (newCount === 0) {
		button.badge = null;
	}
	else {
		button.badge = newCount;
	}
}

function parseGmailFeed(xmlDoc) {
	let fullcountElement = xmlDoc.getElementsByTagName("fullcount").item(0);
	let unreadCount = fullcountElement.innerHTML;
	setEmailCount(unreadCount);
}

function requestGmailFeed() {
	numTries += 1;
	console.log("Trying Gmail! " + numTries);
	let request = xhr.XMLHttpRequest();
	request.onreadystatechange = function() {
		if (request.readyState === 4) {
			console.log("Request status: " + request.status);
			if (request.status === 200) {
				parseGmailFeed(request.responseXML);
				if (signinState === 0) {
					signinState = 1;
					toggleInterval();
				}
				numTries = 0;
			}
			else if (request.status === 401) {
				setEmailCount(0);
				if (signinState === 1 && numTries === 2) {
					panel.show();
					signinState = 0;
					toggleInterval();
					numTries = 0;
				}
			}
		}
	}
	request.open("GET", feedAddress);
	request.send();
}

function toggleInterval() {
	clearInterval(intervalID);
	if (signinState === 0) {
		setInterval(requestGmailFeed, longUpdateFreq);
	}
	else if (signinState === 1) {
		setInterval(requestGmailFeed, standardUpdateFreq);
	}
}

exports.onUnload = function(reason) {
  if (reason) {
  	clearInterval(intervalID);
  }
}

onColorChange();
sprefs.on("color", onColorChange);

requestGmailFeed();
intervalID = setInterval(requestGmailFeed, standardUpdateFreq);
