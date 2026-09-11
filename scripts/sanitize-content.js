'use strict';
const sanitize = require('sanitize-html');
module.exports = function sanitizeContentHtml(value) {
  return sanitize(String(value || ''), {
    allowedTags: ['p','br','strong','b','em','i','u','s','h2','h3','h4','ul','ol','li','blockquote','a','img','figure','figcaption','pre','code','table','thead','tbody','tr','th','td','span','div'],
    allowedAttributes: { a:['href','title','target','rel'], img:['src','alt','width','height','loading'], '*':['class'], th:['scope','colspan','rowspan'], td:['colspan','rowspan'] },
    allowedSchemes: ['https','http','mailto','tel'],
    allowedSchemesByTag: {img:['https','http']},
    allowProtocolRelative: false,
    transformTags: {a: (tag, attributes) => ({tagName:tag,attribs:{...attributes,...(attributes.target === '_blank' ? {rel:'noopener noreferrer'} : {})}})}
  });
};
