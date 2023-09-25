const express = require('express');
const http = require('http');
const serveStatic = require('serve-static');      //특정 폴더의 파일들을 특정 패스로 접근할 수 있도록 열어주는 역할
const path = require('path');
const cookieParser = require('cookie-parser');
const expressSession = require('express-session');
const axios = require('axios');
const mysql = require('mysql2');
const bcrypt = require('bcrypt'); //비밀번호 암호화를 위한 역할
const mysqlSession = require('express-mysql-session')(expressSession);
const cors = require('cors');
var app = express();      //express 서버 객체

let bodyParser_post = require('body-parser');       //post 방식 파서
const socketIo = require('socket.io');//서버 연결



app.set('port', 3000);
//render함수를 처리하기 위한 views폴더 설정
app.set('view engine', 'ejs'); 
app.set('views', path.join(__dirname, 'views')); 
//axios를 이용한 데이터처리
//axios.defaults.withCredentials = true;

//미들웨어들 등록 시작, 아래 미들웨어들은 내부적으로 next() 가실행됨

//join은 __dirname : 현재 .js 파일의 path 와 public 을 합친다
//이렇게 경로를 세팅하면 public 폴더 안에 있는것을 곧바로 쓸 수 있게된다
app.use(serveStatic(path.join(__dirname, 'public')));


//post 방식 일경우 begin
//post 의 방식은 url 에 추가하는 방식이 아니고 body 라는 곳에 추가하여 전송하는 방식
app.use(bodyParser_post.urlencoded({ extended: false }));            // post 방식 세팅
app.use(bodyParser_post.json()); // json 사용 하는 경우의 세팅


//post 방식 일경우 end



//데이터 옵션
const option = {
    host : 'localhost',
    port : 3306,
    user : 'root',
    password : '1234',
    database : 'authtest'
}
//세션 옵션
const sessionOption = {
    secret : 'SecretKey',
    resave : false,
    saveUninitialized : false,
    store : new mysqlSession(option)
}

app.use(expressSession(sessionOption));

//mysql과 연결
const db = mysql.createConnection({
    host : 'localhost',
    port : 3306,
    user : 'root',
    password : '1234',
    database : 'authtest'
})
db.connect();
module.exports = db; //다른 파일에서 사용할 수 있게 함 -> 이거 잘 이용해야 파일 분리될듯?

//CORS 오류 해결
app.use(cors({
    origin : true,
    credentials : true
}));

//쿠키와 세션을 미들웨어로 등록한다
app.use(cookieParser());

//세션 환경 세팅
//세션은 서버쪽에 저장하는 것을 말하는데, 파일로 저장 할 수도 있고 레디스라고 하는 메모리DB등 다양한 저장소에 저장 할 수가 있는데
app.use(expressSession({
    key : 'login123',
    secret: 'my key',           //이때의 옵션은 세션에 세이브 정보를 저장할때 할때 파일을 만들꺼냐
    //아니면 미리 만들어 놓을꺼냐 등에 대한 옵션들임
    resave: true,
    saveUninitialized: false,
    cookie : {
        expires : 10000, //쿠키가 얼마나 지속될건지 설정 - 세션 관리용 -> 만료 되게
    },
    Maxage : 10000,
    })
);

//라우트를 미들웨어에 등록하기 전에 라우터에 설정할 경로와 함수를 등록한다
//
//라우터를 사용 (특정 경로로 들어오는 요청에 대하여 함수를 수행 시킬 수가 있는 기능을 express 가 제공해 주는것)
let router = express.Router();

//http://localhost:3000/process/main 이 주소로 치면 라우터를 통해 바로 여기로 올 수 있다
router.route('/process/main').get(
    function (req, res) {
        console.log('/process/main  라우팅 함수 실행');

        //세션정보는 req.session 에 들어 있다
        if (req.session.user)       //세션에 유저가 있다면
        {
            const user = req.session.user;
            res.render('main', { newUser: user }); //main.ejs에 user정보 전달
            
        }
        else {
            res.redirect('/login.html');
        }
    }
);

const saltRounds = 10; //비밀번호만 암호화 10번진행 bcrypt이용

router.route('/process/login').post(                      //설정된 쿠키정보를 본다
    function (req, res) {
        console.log('/process/login 라우팅 함수호출 됨');
        var paramID = req.body.id || req.query.id;
        var pw = req.body.passwords || req.query.passwords;
        const info1 = [paramID, pw];
        if (req.session.user) {
            console.log('이미 로그인 되어 있음');
            res.redirect("/main.html");
        } else {
            db.query('SELECT * FROM users WHERE userid = ?', info1[0], function(err, row) {
                if(err) {
                    console.log(err);
                }    
                if(row.length > 0) {
                    bcrypt.compare(info1[1], row[0].password, function(err, result){
                        if(result) {
                            req.session.user =
                            {
                                id: paramID,
                                pw: pw,
                                name: row[0].name,
                                authorized: true
                            };
                            const user = req.session.user;
                            res.render('main', { newUser: user }); // main.html을 렌더링하여 클라이언트에게 전달
                            //main.html에 user정보 전달 -> 프론트에서 자바스크립트로 받기
                            // res.redirect("/main.html");
                        }
                        else {
                            console.log('없는 아이디이거나 비밀번호입니다.'); 
                            res.redirect('/login.html');
                        }
                    });
                }
                else {
                    console.log('없는 아이디이거나 비밀번호입니다.');
                    res.redirect('/login.html');
                }
            });
        }
    }
);

router.route('/process/logout').get(                      //설정된 쿠키정보를 본다
    function (req, res) {
        console.log('/process/logout 라우팅 함수호출 됨');

        if (req.session.user) {
            console.log('로그아웃 처리');
            req.session.destroy(
                function (err) {
                    if (err) {
                        console.log('세션 삭제시 에러');
                        return;
                    }
                    console.log('세션 삭제 성공');
                    //파일 지정시 제일 앞에 / 를 붙여야 root 즉 public 안에서부터 찾게 된다
                    res.redirect('/login.html');
                }
            );          //세션정보 삭제

        } else {
            console.log('로그인 안되어 있음');
            res.redirect('/login.html');
        }



    }
);
//회원가입쪽 구현


//마지막 2개는 소속단과대학, 분과
router.route('/process/signup').post(
    function(req, res) {
        console.log('/process/signup 라우팅 함수호출 됨');
        const info = [req.body.id, req.body.passwords, req.body.phone_num, req.body.student_id, req.body.name,
            req.body.affilation, req.body.division];
        bcrypt.hash(info[1], saltRounds, function(error, hash) {
            info[1] = hash;
            db.query('INSERT INTO users(userid, password, phone_num, student_id, name, affilation, division) VALUE(?,?,?,?,?,?,?)'
            , info, function(err, row) {
                if(err) {
                    console.log(err);
                }    
            });
        })
        
        // JavaScript로 경고창을 표시하고 사용자가 확인을 누르면 리디렉션을 수행
        // VALUE(?,?,?) 이거 보안 향상위해서 넣음
        const confirmation = `<script>
            window.alert('당신의 아이디는 다음과 같습니다 : ${info[0]}');
            window.location.href = '/login.html';
        </script>`;
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.write(confirmation);
        res.end();
    }

);

 router.route('/process/reserve').get(
     function(req, res) {
       console.log('/process/reserve 라우팅 함수호출 됨');
       res.redirect('/reserve.html')
     }
 );

 // 예약 정보 가져오기 함수
function getReservationInfo(req) {
    const userid = req.session.userid; // 세션 정보 읽기
    // 여기서 username을 사용하여 예약 정보를 검색 또는 처리
    return userid;
  }
  


//라우터 미들웨어 등록하는 구간에서는 라우터를 모두  등록한 이후에 다른 것을 세팅한다
//그렇지 않으면 순서상 라우터 이외에 다른것이 먼저 실행될 수 있다

app.use('/', router);       //라우트 미들웨어를 등록한다


app.all('*',
    function (req, res) {
        res.status(404).send('<h1> 요청 페이지 없음 </h1>');
    }
);

//웹서버를 app 기반으로 생성
var appServer = http.createServer(app);
appServer.listen(app.get('port'),
    function () {
        console.log('http://localhost:' + app.get('port') + '/process/main');
    }
);
const io = socketIo(appServer);
// 예약 기능 모듈 사용
const reservationModule = require('./reserve.js');
reservationModule(io);

module.exports = {
    getReservationInfo,
  };