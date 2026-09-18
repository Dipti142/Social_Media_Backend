'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Otp extends Model {
    static associate(models) {
      // Define associations here later if needed
    }
  }

  Otp.init(
    {
      email: {
        type: DataTypes.STRING,
        allowNull: false
      },
      otp: {
        type: DataTypes.STRING,
        allowNull: false
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      isUsed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'verification'
      }
    },
    {
      sequelize,
      modelName: 'Otp',
      tableName: 'Otps'
    }
  );

  return Otp;
};
