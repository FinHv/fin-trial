# **fin-trial**

**fin-trial** is a Node.js application that monitors and manages user quotas and trials in a `glFTPd`/IRC environment.
Its in testing phase so if you want something new or report a bug let me know. 
---

## **Features**

- **User Management**: Manage user statuses (`Quota`, `Trial`, and `Deletion`) directly via IRC commands. (it reads the user files of glFTPd)
- **Quota Monitoring**: Automatically monitor and reset user quotas on a weekly basis.
- **Trial Monitoring**: Track and manage users during their trial period.
- **Daily Reports**: Generate and announce daily reports of top uploaders for specified channels.
- **Blowfish Encryption**: Secure communication using Blowfish-encrypted messages.

---

## **Public Commands**

### **!top**
- **Description**: Displays the top uploaders, including users in `Quota` and `Trial` statuses.
- **Usage**: `!top`
- **Response Example**:

```
<@BOT> WEEKLY QUOTA: 13 Users - 3 days, 10 hours, 21 minutes Remaining - (Min 250GB)
<@BOT> [ 01 ] name1/iND ( 1.9TB Up ) is currently PASSING.
<@BOT> [ 02 ] name2/iND ( 1.4TB Up ) is currently PASSING.
<@BOT> [ 03 ] name3/iND ( 991.1GB Up ) is currently PASSING.
<@BOT> [ 04 ] name4/iND ( 825.2GB Up ) is currently PASSING.
<@BOT> [ 05 ] name5/iND ( 803.4GB Up ) is currently PASSING.
<@BOT> [ 06 ] name6/iND ( 642.5GB Up ) is currently PASSING.
<@BOT> [ 07 ] name7/iND ( 626.6GB Up ) is currently PASSING.
<@BOT> [ 08 ] name/iND ( 466.8GB Up ) is currently PASSING.
<@BOT> [ 09 ] name/iND ( 396.4GB Up ) is currently PASSING.
<@BOT> [ 10 ] name/iND ( 360.0GB Up ) is currently PASSING.
<@BOT> [ 11 ] name/iND ( 254.0GB Up ) is currently PASSING.
<@BOT> [ 12 ] name/iND ( 244.1GB Up ) is currently FAILING.
<@BOT> [ 13 ] name/iND ( 84.4GB Up ) is currently FAILING.
<@BOT> 
<@BOT> TRIAL QUOTA: Trial List - 2 Trialing - (Min 150GB)
<@BOT> [ 1 ] name/iND ( 144.1GB Up ) is currently FAILING.
<@BOT> [ 2 ] name/iND ( 84.4GB Up ) is currently FAILING.
```

## **Install**

easy is to install nvm:  https://github.com/nvm-sh/nvm?tab=readme-ov-file#install--update-script

then run ```nvm install node```

after that cd into the app root directory:

```cd /glftpd/fin-trial```

type 
```npm install```

u are now ready to start the app. (run it in a screen session or make a service etc..) 

``` node main.js ```    

Use this if you get some ssl error 
```node --openssl-legacy-provider main.js```


## **Staff Commands (`!ft`)**

Available **only** in staff channels for authorized users.

### **!ft trial <username>**
- **Description**: Moves a user to `Trial` status.
- **Usage**: `!ft trial <username>`
- **Example**:

```
!ft trial JohnDoe 
```

```
<@BOT> User JohnDoe updated to trial.
```

### **!ft quota <username>**
- **Description**: Moves a user to `Quota` status.
- **Usage**: `!ft quota <username>`
- **Example**:
```
!ft quota JohnDoe
```

```
<@BOT> User JohnDoe updated to quota.
```

### **!ft extend <username> <days>**
- **Description**: Extends the trial or quota period for a user by the specified number of days.
- **Usage**: `!ft extend <username> <days>`
- **Example**:
```
!ft extend JohnDoe 7
```

```
<@BOT> User JohnDoe's period extended by 7 days.
```

### **!ft delete <username>**
- **Description**: Flags the user for deletion and creates a goodbye file.
- **Usage**: `!ft delete <username>`
- **Example**:
```
!ft delete JohnDoe
```

```
<@BOT> User JohnDoe marked for deletion.
```

Top uploaders of the day: 
The bot will also show the top 10 uploaders in a interval (see config) in specified channel
```
<@BOT> TOP UPLOADERS FOR THE DAY: 10 Users
<@BOT> 01 shadowhawk - (1531 Files) - (119.7GB)
<@BOT> 02 pixelmaster - (617 Files) - (105.3GB)
<@BOT> 03 blaze - (564 Files) - (61.5GB)
<@BOT> 04 nightwolf - (831 Files) - (60.1GB)
<@BOT> 05 crimson - (815 Files) - (51.3GB)
<@BOT> 06 techie - (433 Files) - (34.3GB)
<@BOT> 07 skywalker - (329 Files) - (31.3GB)
<@BOT> 08 ghost - (624 Files) - (27.0GB)
<@BOT> 09 sentinel - (113 Files) - (21.2GB)
<@BOT> 10 thunderbolt - (256 Files) - (16.5GB)
<@BOT> TOTAL UPLOADS FOR THE DAY: 6113 Files - 528.4GB
```


When you run it:
 
``` node --openssl-legacy-provider main.js ```

The script will create a SQLite database, and by default, every user will be put on a quota. The database updates every *x* minutes. If something goes wrong, you can simply delete the database file and run the script again. (See the configuration file to exclude specific users or groups.) 

To put a user on trial, use the appropriate command mentioned above. 

There is no need to edit anything on the glFTPd site. The bot is built to respond to commands, and you can add your own commands if needed! Check out `irc.js` for details.

The application connects to a ZNC server, so you need to create a new user, connect it to your channels, and add the ZNC connection string in the configuration:
```connectstring: username/network:password```

Edit config.json, it looks like this! 
```
{
  "server": {
    "host": "",
    "port": 5050,
    "ssl": true,
    "nickname": "NiNJA",
    "connectstring": "NinjaB0T/ninja:cowabanga!",
    "channels": [
      { "name": "#NiNJA-chat", "blowfishKey": "somecbckey" },
      { "name": "#NiNJA", "blowfishKey": "somecbckey" }
    ]
  },
  "paths": {
    "usersDir": "/glftpd/ftp-data/users",
    "byeFiles": "/glftpd/ftp-data/byefiles",
    "msgs": "/glftpd/ftp-data/msgs",
    "databaseFile": "user_stats.db"
  },
  "settings": {
    "updateInterval": 300000,
    "userSkip":  ["default.user", "NUKEBOT", "glftpd"],
    "excludedGroups": ["Admin", "SiteOP", "Friends", "Leech", "NUKERS", "NoGroup"],
    "announceTopDayChan": ["#NiNJA-chat"],
    "BlowfishKeyTopDayChan": "somecbckey",
    "showTopDayUp": true,
    "showTopDayUpInterval": 28800000,
    "staffUsers": ["ninja","otheruser"],
    "staffChan": ["#NiNJA-staff"],
    "blowfishKeyStaffChan": "somecbckey"
  },
  "trialConfig": {
    "quotaGB": "150",
    "daysDefault": 7,
    "enabled": true,
    "failSetFlagsTrial": "6"
  },
  "quotaConfig": {
    "quotaGB": "250",
    "enabled": true,
    "failSetFlagsQuota": "6",
    "failBackToTrial": true
  }
}
```



