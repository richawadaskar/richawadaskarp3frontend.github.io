import React from 'react';
import logo from './logo.svg';
import './App.css';
import axios from 'axios'

const server_url = "http://chat.cs291.com/"
var signed_token = ""
var sse = null

class App extends React.Component {
  constructor(props) {
    super(props)
    this.state = {showLogin: true, showChatRoom: false, showFailedLogin: false, messages: [], users: []}
    this.user_list = this.user_list.bind(this)
    this.user_join = this.user_join.bind(this)
    this.user_part = this.user_part.bind(this)
    this.message_history = this.message_history.bind(this)
    this.new_message = this.new_message.bind(this)
    this.server_disconnect = this.server_disconnect.bind(this)
    this.server_status = this.server_status.bind(this)
  }

  loginSuccessful = (signed_token) => {
    this.setState({showLogin: false, showChatRoom: true, showFailedLogin: false})
    const url = server_url + "/stream/" + signed_token
    var sse = new EventSource(url);
    sse.onmessage = function(e) {
      console.log("event received.")
      console.log(e.data);
    }

    sse.addEventListener("Users", e => this.user_list(e))
    sse.addEventListener("Join", e => this.user_join(e))
    sse.addEventListener("Part", e => this.user_part(e))
    sse.addEventListener("Message", e => this.new_message(e))
    sse.addEventListener("Messages", e => this.message_history(e))
    sse.addEventListener("Disconnect", e => this.server_disconnect(e))
    sse.addEventListener("ServerStatus", e => this.server_status(e))
  }

  user_list(e) {
    console.log("User List Receivd")
    console.log(e)
    const online_user_list = JSON.parse(e.data)["users"]
    this.setState({users: online_user_list})
  }

  server_disconnect(e) {
    console.log("Server Disconnect Receivd")
    console.log(e)
    if(sse){
      sse.close()
    }
    this.setState({showLogin: true, showChatRoom: false, showFailedLogin: false})
  }

  user_join(e) {
    console.log("User Join Received")
    console.log(e)
    const new_user = JSON.parse(e.data)["user"]
    console.log("new user")
    console.log(new_user)
    var user_list = this.state.users
    user_list.push(new_user)
    var message_list = this.state.messages
    message_list.push(this.format_event(JSON.parse(e.data), "Join"))
    this.setState({users: user_list, messages: message_list})
  }

  new_message(e) {
    console.log("New Message Receivd")

    var new_message = JSON.parse(e.data)
    console.log(new_message)
    var message_list = this.state.messages
    const uid = e.lastEventId
    console.log("uid of last_event_id")
    console.log(uid)

    message_list.push(this.format_event(new_message, "Message"))
    console.log(message_list)
    this.setState({messages: message_list})
  }

  message_history(e) {  // should only be receiving Message and ServerSent events.
    console.log("Message Histrory Received")
    console.log(e)

    var list_of_msgs = (JSON.parse(e.data))["messages"]
    console.log(list_of_msgs)
    var local_msgs = this.state.messages
    console.log("local messages")
    console.log(local_msgs)
    for(let i = 0; i < list_of_msgs.length; i++){
      local_msgs.push(this.format_event(list_of_msgs[i], ""))
    }

    console.log("New local messages:")
    console.log(local_msgs)
    this.setState({messages: local_msgs})
  }

  user_part(e) {
    console.log("User Part Receivd")
    console.log(e)
    const parted_user = JSON.parse(e.data)["user"]
    console.log(parted_user)
    var user_list = this.state.users
    for( var i = 0; i < user_list.length; i++){
       if ( user_list[i] == parted_user) {
         user_list.splice(i, 1);
       }
    }
    var new_message = JSON.parse(e.data)
    var message_list = this.state.messages
    message_list.push(this.format_event(JSON.parse(e.data), "Part"))

    console.log("new User list")
    console.log(user_list)
    this.setState({users: user_list, messages: message_list})
  }

  server_status(e) {
    console.log("Server Status Receivd")
    console.log(e)
    var new_message = JSON.parse(e.data)
    var message_list = this.state.messages
    message_list.push(this.format_event(new_message, "SERVER_STATUS"))
    this.setState({messages: message_list})
  }

  format_event(text, event_name) {
    console.log("formatting event: ")
    console.log(text)
    const date = date_format(text["created"])
    var str = "" + date + ": "
    if (event_name == "Join") {
      str += " JOIN " + text["user"]
    } else if (event_name == "Part") {
      str += " PART " + text["user"]
    } else if (event_name == "SERVER_STATUS" || text["status"]) {
      str += "(SERVER_STATUS) " + text["status"]
    } else {
      str += "(" + text["user"] + ") " + text["message"]
    }
    return str
  }

  loginFailed = () => {
    this.setState({showFailedLogin: true})
  }

  componentWillUnmount() {
    if(sse){
      sse.close()
    }
  }

  render() {
    console.log("rendering application")
    console.log("current value of users is: " + this.state.users)
    return (
      <div className="App">
        <ChatRoomTitle/>
        {this.state.showLogin ? <LoginPage loginSuccessful={this.loginSuccessful} loginFailed={this.loginFailed}/> : null}
        {this.state.showFailedLogin ? <p>Login Failed</p>: null}
        <div className="ChatRoom" hidden={!this.state.showChatRoom}>
          <div className="ChatRoomBody">
            <UserList userList={this.state.users}/>
            <MessageList messageList={this.state.messages}/>
          </div>
          <Compose/>
        </div>
      </div>
    );
  }
}

class ChatRoomTitle extends React.Component {
  constructor() {
    super()
  }

  render() {
    return (
      <header>
        <h1>Chat Room</h1>
      </header>
    )
  }
}

class Compose extends React.Component {
  constructor() {
    super()
  }

  submitClicked() {
    console.log("Submit button was clicked.")
    const user_msg = document.getElementById("composeInputBox").value
    console.log(user_msg)
    document.getElementById("composeInputBox").value = ""

    // hit server with new user message.
    const xhr = new XMLHttpRequest()
    const url = server_url + "/message"
    xhr.open('POST', url)
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.setRequestHeader('Authorization', 'Bearer ' + signed_token)

    // xhr.onreadystatechange = printOutput;
    xhr.onload = function () {
      console.log("response received from serverr: ")
      console.log(xhr.response)

      // re render UI if message was successfully posted.
      if(xhr.status === 201){
        console.log("message was posted.")
      } else if(xhr.status === 403){
        console.log("Signed token is not valid")
      } else if(xhr.status === 422) {
        console.log("Message sent was blank.")
      }
    }
    xhr.send("message=" + user_msg)

  }

  render() {
    // this should be the box at the bottom that allows users to post messages
    return (
      <div className="compose">
        <input type="text" id="composeInputBox" name="userMessage"/>
        <input type="submit" value="Send Message" onClick={this.submitClicked}/>
      </div>
    )
  }
}

class LoginPage extends React.Component {
  constructor(props) {
    super(props)
    console.log(props)
    this.props = props
    console.log(this.props)
  }

  validateLogin = () => {

    console.log("validating login information")
    console.log("this.props")
    console.log(this.props)

    const username = document.getElementById("userrr").value;
    const password = document.getElementById("passss").value;

    // hit the server endpoint here.
    const xhr = new XMLHttpRequest()
    const url = server_url + "/login"
    xhr.open('POST', url)
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

    const props = this.props

    // xhr.onreadystatechange = printOutput;
    xhr.onload = function () {
      console.log("response received from serverr: ")
      console.log(xhr.response)

      // re render UI if login is successful.
      if(xhr.status === 201){
        console.log("login was successful")
        signed_token = JSON.parse(xhr.response)["token"]
        props.loginSuccessful(signed_token)
        // sse = new SSE(signed_token)
      } else {
        console.log("Login failed")
        props.loginFailed()
      }
    }

    const msg = 'username=' + username + '&password=' + password;
    console.log(msg);
    xhr.send(msg)
  }

  render() {
    const element = (<div className="login">
      <form>
        <label for="username">Username:</label>
        <input id="userrr" type="text" name="username"/><br></br>
        <label for="password">Password:</label>
        <input id="passss" type="password" name="password"/><br></br>
        <button type="button" onClick={this.validateLogin}>Login</button>
      </form>
    </div>)

    return element
  }
}

class MessageList extends React.Component {
  constructor(props) {
    super(props)
  }

  scrollToBottom = () => {
    this.messagesEnd.scrollIntoView({ behavior: "smooth" });
  }

  componentDidMount() {
    this.scrollToBottom();
  }

  componentDidUpdate() {
    this.scrollToBottom();
  }

  render() {
    console.log("rendering messageList")
    console.log("Messages are")
    console.log(this.props.messageList)
    return (
      <div className="messageList">
        <h3 className="sectionTitle">Messages</h3>
        <div className="messages">
          {
            this.props.messageList.map((elm, index) =>
              <li key={index}> {elm} </li>
            )
          }
        </div>
        <div style={{ float:"left", clear: "both" }}
          ref={(el) => { this.messagesEnd = el; }}>
        </div>
      </div>
    )
  }
}

class UserList extends React.Component {
  constructor(props) {
      super(props)
  }

  render() {
    console.log("rendering user list.")
    console.log("Users are")
    console.log(this.props.userList)
    return (
      <div className="userList">
        <h3 className="sectionTitle">Online</h3>
        <div className="usersOnline">
          {this.props.userList.map((text, index) =>
            <li key={index}> {text} </li>
          )}
        </div>
      </div>
    )
  }
}

function date_format(timestamp) {
    var date = new Date(timestamp * 1000);
    return (
        date.toLocaleDateString("en-US") +
        " " +
        date.toLocaleTimeString("en-US")
    );
}

export default App;
