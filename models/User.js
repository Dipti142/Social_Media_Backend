'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {

  class User extends Model {

    static associate(models) {
      // Define associations here later
    }

  }

  User.init(
    {
      username: {
        type: DataTypes.STRING,
        allowNull: false
      },

      email: {
        type: DataTypes.STRING,
        allowNull: false
      },

      password: {
        type: DataTypes.STRING,
        allowNull: false
      },

      role: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'user'
      },

      isVerified: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },

      refreshToken: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'Users'
    }
  );

  return User;
};