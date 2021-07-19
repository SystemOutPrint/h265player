/**
 * caijiahe
 */

 import Logger from "./Logger"
 import {
   throwError
 } from "../error/ThrowError"
import SegmentModel from "../model/SegmentModel"
 
 let logger = Logger.get('ManifestParser.js', {
   level: 2
 })
 
 const segment = {
   file: undefined,
   name: undefined,
   start: 0,
   end: 0,
   discontinuity: undefined,
   duration: undefined
 }
 
 export class ManifestParser {
   source = ''
   duration = 0
   length = 0
   segments = []
   discontinuous = null

   constructor(source, options = {}) {
     this.source = source
     this.options = options
     this.parse(this.source)
   }
 
   parse(source) {
     source = source || this.source
     if (typeof source !== 'string') {
       throwError('manifest file is not text.', source)
       return
     }
    
     let m = JSON.parse(source)
     let manifestSegs = m.segments
     this.duration = m.duration/1000
     this.length = manifestSegs.length

     let lastStartTime = 0
     manifestSegs.forEach((item, idx) => {
        const seg = this.segments[idx] || Object.assign({}, segment, {
            file: item.url,
            name: item.url,
            duration: item.duration,
            start: lastStartTime,
            end: lastStartTime + item.duration
        })
        this.segments[idx] = seg
        lastStartTime = seg.end
     })
     return this
   }

   duration() {
    return this.duration
   }

   length() {
     return this.length
   }
}

export default ManifestParser