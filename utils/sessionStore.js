// 存储在内存中的session，临时测试，实现express session + redis后可删除

/* abstract */ class SessionStore {
    findSession(id) {}
    saveSession(id, session) {}
    findAllSessions() {}
  }
  
  class InMemorySessionStore extends SessionStore {
    constructor() {
      super();
      this.sessions = new Map();
    }
  
    findSession(id) {
      return this.sessions.get(id);
    }
  
    saveSession(id, session) {
      this.sessions.set(id, session);
    }
  
    findAllSessions() {
      return [...this.sessions.values()];
    }
  }
  
  module.exports = {
    InMemorySessionStore
  };