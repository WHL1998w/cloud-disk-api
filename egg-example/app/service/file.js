'use strict'

const Service = require('egg').Service

class FileService extends Service {
    // 目录是否存在
    async isDirExist(id) {
        let f = await this.app.model.File.findOne({
            where: {
                id,
                user_id: this.ctx.authUser.id,
                isdir: 1,
            },
        })
        if (!f) {
            return this.ctx.throw(404, '目录不存在')
        }
        return f
    }

    // 文件是否存在
    async isExist(id) {
        let f = await this.app.model.File.findOne({
            where: {
                id,
                user_id: this.ctx.authUser.id,
            },
        })
        if (!f) {
            return this.ctx.throw(404, '文件不存在')
        }
        return f
    }
}

module.exports = FileService