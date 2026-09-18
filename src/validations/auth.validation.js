const Joi = require('joi');

const registerSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
});

const loginSchema = Joi.object({
    email: Joi.string().email(),
    username: Joi.string().alphanum().min(3).max(30),
    password: Joi.string().required()
}).or('email', 'username');

module.exports = {
    registerSchema,
    loginSchema
};
