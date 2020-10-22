"use strict";

const Controller = require("egg").Controller;

class HomeController extends Controller {
  async index() {
    const { ctx } = this;
    ctx.body = "hello world";
  }


  async list() {
    this.ctx.body = {
      msg: "ok",
      data: [
        {
          name: "微服务",
          price: 100,
        },
        {
          name: "Java",
          price: 88,
        },
        {
          name: "JavaScript",
          price: 77,
        },
      ],
      list: [
				{
					type: 'dir',
					name: '我的笔记',
					create_time: '2020-10-21 08:00',
					checked: false
				},
				{
					type: 'image',
					name: '风景.jpg',
					create_time: '2020-10-21 08:00',
					checked: false
				},
				{
					type: 'video',
					name: 'uniapp实战教程.mp4',
					create_time: '2020-10-21 08:00',
					checked: false
				},
				{
					type: 'text',
					name: '记事本.txt',
					create_time: '2020-10-21 08:00',
					checked: false
				},
				{
					type: 'none',
					name: '压缩包.rar',
					create_time: '2020-10-21 08:00',
					checked: false
				}
			]
    };
  }
}

module.exports = HomeController;