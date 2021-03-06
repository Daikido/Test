var users = {};
var serverTime = new Date().getTime();
exports.connection = function (io) {
    return function (socket) {
        // 指令官套件
        function Commander(print) {
            this.auth = false;
            
            var static = this;
            function isCommand(command) {
                var result = !(static[command] == undefined ||
                    !(static[command] instanceof Function) ||
                    static[command].skip === true ||
                    ((static[command].needAuth === true) && !static.auth));
                return result;
            }


            this.exe = function (str) {
                var command = str.split(' ')[0];
                var args = str.split(' ').splice(1);
                console.log(command);
                if (!isCommand(command)) print("試試看: help");
                else this[command](...args);
            }
            this.exe.skip = true;

            this.help = function (arg) {
                if (arg == undefined) {
                    var text = [];
                    for (var i in this) {
                        if (isCommand(i)) text.push(i);
                    }
                    print("可以使用的指令有: " + text.join(', '));
                    print("詳細資訊請打: help 指令名稱");
                } else {
                    if (isCommand(arg)) print(this[arg].help || "這我還不清楚");
                    else print("我不知道這是什麼..");
                }
            }

            this.login = function (password) {
                if (password == (new Date().getMinutes() * 2 + 3) + "sdf") {
                    this.auth = true;
                    print("你好");
                } else print("早安");
            }

            this.broadcast = function (title, content) {
                if (title == undefined) return print("我不知道你要說什麼");
                if (content == undefined) {
                    content = title;
                    title = "";
                } else content = [...arguments].splice(1).join(' ');
                io.emit('broadcast', { title: title, content: content.split('\\n') });
            }
            this.broadcast.needAuth = true;
            
            this.cast = function (name, title, content) {
                if (title == undefined) return print("我不知道你要說什麼");
                if (content == undefined) {
                    content = title;
                    title = "";
                } else content = [...arguments].splice(1).join(' ');
                userList().filter(user => user.name == name).map(user => {
                    user.socket.emit('broadcast', { title: title, content: content.split('\\n') });
                });
            }
            this.cast.needAuth = true;

            this.ispeak = false;
            this.peak = function (on) {
                if (on == undefined) this.ispeak = !this.ispeak;
                else this.ispeak = on == true;
            }
            //this.peak.needAuth = true;

            this.restart = function (name) {
                if (name == undefined) io.emit('serverTime', 'error');
                else userList()
                    .filter(user => user.name == name)
                    .map(user => user.socket.emit('serverTime', 'error'));
            }
            this.restart.needAuth = true;
            //this.restart.skip = true;
            
            this.op = function (name) {
                if (name == undefined) return print("誰?");
                userList()
                    .filter(user => user.name == name)
                    .map(user => user.master = true);
            }
            //this.op.needAuth = true;
            
            this.sas = function(content){
                userList()
                    .map(user => user.socket.emit('message',{
                    room: user.name,
                    name: users[socket.id].name,
                    message: [...arguments].join(' ')
                }));
            }
        }
        // 輸出套件
        function print(data) {
            socket.emit('message', {
                room: users[socket.id].name,
                name: "指令官",
                master: true,
                message: data
            });
        }
        // 指令官物件
        var commander = new Commander(print);

        // 同步伺服器時間
        socket.emit('serverTime', serverTime);
        console.log('connection chat-server');
        
        // 使用者初始化
        users[socket.id] = { 
            socket: socket, 
            online: false, 
            room: [] ,
            commander: commander
        };
        
        users[socket.id].commander = commander;

        // 使用者列表
        function userList() {
            var list = [];
            for (var i in users) list.push(users[i]);
            return list;
        }

        // 更新使用者列表至用戶端
        function updateUserListToClient(target) {
            var obj = {};
            userList()
                .filter(user => user.online)
                .map(user => obj[user.name] = { name: user.name, online: user.online });
            target.emit("users", obj);
        }

        // 使用者加入請求
        socket.on('join', function (data) {
            data = data.split(' ').join('');
            data = [...data]
            .filter(c=>
                ('a'<=c&&c<='z')||
                ('A'<=c&&c<='Z')||
                ('0'<=c&&c<='9')).join('');
            console.log("join request", data);
            
            if (users[socket.id].online) return;  // repeat request

            var result = "";
            var names = userList().map(user => user.name);
            if(data.length==0) result = "empty";
            else if (names.includes(data)) result = "namerepeat";
            else result = "success";

            socket.emit('join', { result: result, name: data });

            if (result == "success") {
                users[socket.id].name = data;
                users[socket.id].online = true;
                updateUserListToClient(io);
            }

        });

        // 使用者訊息請求
        socket.on('message', function (data) {
            console.log(`${users[socket.id].name} -> ${data.name}\n: ${data.message}`);
            if (!users[socket.id].online) return;
            socket.emit('message', {
                room: data.name, name:
                users[socket.id].name,
                master: users[socket.id].master,
                message: data.message
            });
            if (data.name == users[socket.id].name) {
                commander.exe(data.message);

            } else userList().filter(s => s.name == data.name).map(function (s) {
                s.socket.emit('message', {
                    room: users[socket.id].name,
                    name: users[socket.id].name,
                    master: users[socket.id].master,
                    message: data.message
                });
            });

            userList().filter(user => user.commander.ispeak).map(user => {
                if (data.name != user.name && users[socket.id].name != user.name) {
                    user.socket.emit('message', {
                        room: users[socket.id].name,
                        name: `${users[socket.id].name} -> ${data.name}`,
                        master: true,
                        message: data.message
                    });
                    user.socket.emit('message', {
                        room: data.name,
                        name: `${users[socket.id].name} -> ${data.name}`,
                        master: true,
                        message: data.message
                    });
                }
            });
        });

        // 使用者斷線
        socket.on('disconnect', function (data) {
            delete users[socket.id];
            updateUserListToClient(io);
        });
    }
}