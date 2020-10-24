'use strict'

const Controller = require('egg').Controller

const fs = require('fs')
const path = require('path')

class FileController extends Controller {
    // 上传
    async upload() {
        const {
            ctx,
            app,
            service
        } = this
        const currentUser = ctx.authUser

        console.log(ctx.request.files)

        if (!ctx.request.files) {
            return ctx.apiFail('请先选择上传文件')
        }

        ctx.validate({
            file_id: {
                required: true,
                type: 'int',
                defValue: 0,
                desc: '目录id',
            },
        })

        const file_id = ctx.query.file_id
        console.log(file_id + '&&&&&&&&&')
        let f
        // 目录id是否存在
        if (file_id > 0) {
            // 目录是否存在,存在就返回目录对象，从而取得目录名字，不存在直接在service就出错返回了
            await service.file.isDirExist(file_id).then((res) => {
                console.log(res + '>>>>>>>>>>')
                f = res
            })
        }
        //取得上传的文件对象
        const file = ctx.request.files[0]
        //动态将目录名称作为前缀和文件名拼接
        const name = f.name + '/' + ctx.genID(10) + path.extname(file.filename)

        // 判断用户网盘内存是否不足
        let s = await new Promise((resolve, reject) => {
            fs.stat(file.filepath, (err, stats) => {
                resolve((stats.size / 1024).toFixed(1))
            })
        })

        if (currentUser.total_size - currentUser.used_size < s) {
            return ctx.apiFail('你的可用内存不足')
        }

        // 上传到oss
        let result
        try {
            result = await ctx.oss.put(name, file.filepath)
        } catch (err) {
            console.log(err)
        }

        //得到文件url
        console.log(result.url)

        // 写入到数据表
        if (result) {
            let addData = {
                name: file.filename,
                ext: file.mimeType,
                md: result.name,
                file_id,
                user_id: currentUser.id,
                size: parseInt(s),
                isdir: 0,
                url: result.url,
            }
            let res = await app.model.File.create(addData)

            // 更新用户的网盘内存使用情况
            currentUser.used_size = currentUser.used_size + parseInt(s)
            currentUser.save()

            return ctx.apiSuccess(res)
        }

        ctx.apiFail('上传失败')
    }
    //文件列表实现
    async list() {
        const {
            ctx,
            app
        } = this
        const user_id = ctx.authUser.id
        ctx.validate({
            file_id: {
                required: true,
                type: 'int',
                defValue: 0,
                desc: '目录id',
            },
            orderby: {
                required: false,
                type: 'string',
                defValue: 'name',
                range: {
                    in: ['name', 'create_time'],
                },
                desc: '排序',
            },
            type: {
                required: false,
                type: 'string',
                desc: '类型',
            }
        })
        const {
            file_id,
            orderby,
            type
        } = ctx.query
        let where = {
            user_id,
            file_id
        }
        if (type && type !== 'all') {
            const Op = app.Sequelize.Op
            where.ext = {
                [Op.like]: type + '%',
            }
        }
        let rows = await app.model.File.findAll({
            where,
            Order: [
                ['isdir', 'desc'],
                [orderby, 'desc'],
            ],
        })
        ctx.apiSuccess({
            rows,
        })
    }
    //创建文件夹实现
    async createdir() {
        const {
            ctx,
            app
        } = this
        const user_id = ctx.authUser.id
        ctx.validate({
            file_id: {
                required: true,
                type: 'int',
                defValue: 0,
                desc: '目录id',
            },

            name: {
                required: true,
                type: 'string',
                desc: '文件夹名称',
            }
        })
        let {
            file_id,
            name
        } = ctx.request.body
        //验证目录，id是否存在
        if (file_id) {
            await this.service.file.isDirExist(file_id)
        }
        let res = await app.model.File.create({
            name,
            file_id,
            user_id,
            isdir: 1,
            size: 0,
        })
        ctx.apiSuccess(res)
    }
    //重命名功能实现
    async rename() {
        const {
            ctx,
            app
        } = this
        const user_id = ctx.authUser.id
        ctx.validate({
            id: {
                required: true,
                type: 'int',
                desc: '记录',
            },
            file_id: {
                required: true,
                type: 'int',
                defValue: 0,
                desc: '目录id',
            },

            name: {
                required: true,
                type: 'string',
                desc: '文件名称',
            }
        })
        let {
            id,
            file_id,
            name
        } = ctx.request.body
        //验证目录，id是否存在
        if (file_id > 0) {
            await this.service.file.isDirExist(file_id)
        }
        //文件是否存在
        let f = await this.service.file.isExist(id)
        f.name = name
        let res = await f.save()
        ctx.apiSuccess(res)
    }
    //批量删除文件功能实现
    async delete() {
        const { ctx, app } = this;
        const user_id = ctx.authUser.id;
        ctx.validate({
            ids: {
                required: true,
                type: 'string',
                desc: '记录'
            }
        });
        let { ids } = ctx.request.body;
        ids = ids.split(',');
        //计算删除文件内存
        let files = await app.model.File.findAll({
            where: {
                id: ids,
                user_id
            }
        });
        let size = 0;
        files.forEach(item => {
            size = size + item.size
        });
        let res = await app.model.File.destroy({
            where: {
                id: ids,
                user_id
            }
        });
        if (res) {
            //减去使用内存
            size = ctx.authUser.used_size - size;
            ctx.authUser.used_size = size > 0 ? size : 0;
            ctx.authUser.save();
        }
        ctx.apiSuccess(res);
    }
    //搜索文件功能实现
    async search() {
        const { ctx, app } = this;
        const user_id = ctx.authUser.id;
        ctx.validate({
            keyword: {
                required: true,
                type: 'string',
                desc: '关键字'
            },
        })
        let { keyword } = ctx.query
        const Op = app.Sequelize.Op
        let rows = await app.model.File.findAll({
            where: {
                name: {
                    [Op.like]: `%${keyword}%`
                },
                isdir: 0,
                user_id
            }
        })
        ctx.apiSuccess({
            rows
        })
    }

    //保存到自己的网盘
    async saveToSelf() {
        const { ctx, app, service } = this;
        let current_user_id = ctx.authUser.id

        ctx.validate({
            dir_id: {
                type: "int",
                required: true,
                desc: "目录ID"
            },
            sharedurl: {
                type: "string",
                required: true,
                desc: "分享标识"
            },
        })

        let { dir_id, sharedurl } = ctx.request.body

        // 分享是否存在
        let s = await service.share.isExist(sharedurl, {
            include: [{
                model: app.model.File
            }]
        })

        if (s.user_id === current_user_id) {
            return ctx.apiSuccess('本人分享，无需保存')
        }

        // 文件是否存在
        if (dir_id > 0) {
            await service.file.isDirExist(dir_id)
        }

        // 查询该分享目录下的所有数据
        let getAllFile = async (obj, dirId) => {
            let data = {
                name: obj.name,
                ext: obj.ext,
                md: obj.md,
                file_id: dirId,
                user_id: current_user_id,
                size: obj.size,
                isdir: obj.isdir,
                url: obj.url,
            }

            // 判断当前用户剩余空间
            if ((ctx.authUser.total_size - ctx.authUser.used_size) < data.size) {
                return ctx.throw(400, '你的可用内存不足');
            }

            // 直接创建
            let o = await app.model.File.create(data)

            // 更新user表的使用内存
            ctx.authUser.used_size = ctx.authUser.used_size + parseInt(data.size);
            await ctx.authUser.save();

            // 目录
            if (obj.isdir) {
                // 继续查询下面其他的数据
                let rows = await app.model.File.findAll({
                    where: {
                        user_id: obj.user_id,
                        file_id: obj.id,
                    }
                });

                rows.forEach((item) => {
                    getAllFile(item, o.id)
                })

                return
            }
        }

        await getAllFile(s.file, dir_id)

        ctx.apiSuccess('ok')

    }
}

module.exports = FileController
