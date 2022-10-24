const Sequelize = require("sequelize");
const { STRING } = Sequelize;
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const config = {
  logging: false,
};

const SECRET = process.env.JWT;

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(
  process.env.DATABASE_URL || "postgres://localhost/acme_db",
  config
);

const Note = conn.define("note", {
  text: STRING,
});

const User = conn.define("user", {
  username: STRING,
  password: STRING,
});

Note.belongsTo(User);
User.hasMany(Note);

User.byToken = async (token) => {
  try {
    const { userId } = jwt.verify(token, SECRET);

    const user = await User.findByPk(userId);
    // console.log('user in .byToken: ', user);

    if (user) {
      return user;
    }
  } catch (ex) {
    const error = Error("bad credentials");
    error.status = 401;
    throw error;
  }
};

User.authenticate = async ({ username, password }) => {
  const user = await User.findOne({
    where: {
      username,
    },
  });
  if (user && (await bcrypt.compare(password, user.password))) {
    // console.log("WHATS THE USER?", user);
    const token = jwt.sign({ userId: user.id }, SECRET);
    return token;
  }
  const error = Error("bad credentials");
  error.status = 401;
  throw error;
};

// BEFORE CREATING A USER HASH THE PASSWORD
User.beforeCreate(async (user) => {
  // before the user is created.
  const hashedPassword = await bcrypt.hash(user.password, 10); //create a hashed password
  user.password = hashedPassword; //set the users password to the hashed password
});

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  const credentials = [
    { username: "lucy", password: "lucy_pw" },
    { username: "moe", password: "moe_pw" },
    { username: "larry", password: "larry_pw" },
  ];
  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );
  const notes = [
    { text: "lucy like to sing and dance" },
    { text: "moe likes to eat bbq and banans" },
    { text: "moe goes dancing with lucy" },
    { text: "larry dances alone" },
  ];
  const [note1, note2, note3, note4] = await Promise.all(
    notes.map((note) => Note.create(note))
  );
  await lucy.setNotes(note1);
  await moe.setNotes([note2, note3]);
  await larry.setNotes(note4);

  return {
    users: {
      lucy,
      moe,
      larry,
    },
    notes: {
      note1,
      note2,
      note3,
      note4,
    },
  };
};

module.exports = {
  syncAndSeed,
  models: {
    User,
    Note,
  },
};
