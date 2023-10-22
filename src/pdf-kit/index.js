import React, { useEffect, useState, useRef } from 'react'
import { PDFDocument, PDFName, PDFHexString, StandardFonts, rgb, degrees, grayscale } from 'pdf-lib'
import metadata from './filemetadata.json';

const LoadPDF = () => {

    let { sys_topLevel = [] } = metadata || {};

    // 'CHECKBOX', 'LIST', 'NUMBER', 'RADIO', 'TEXTBOX', 'TEXTAREA'
    let compatibleTypes = sys_topLevel?.filter((eachField)=> [ 'CHECKBOX', 'LIST', 'NUMBER', 'RADIO', 'TEXTBOX', 'TEXTAREA', 'SECTION', 'MASK' ].includes(eachField?.type));

    const [pdfData, setPdfData] = useState("empty");
    const [fieldsValue, setFieldsValue] = useState({});
    let valueObj = {};

    const getCoordinates = (props) => {
        let {previousValue:{type}, x, y, index } = props || {};
        let x_axis = x, y_axis = y;
        if(['TEXTAREA', 'SECTION']?.includes(type)){
            x_axis = 50;
            if(type === 'SECTION')
                y_axis = y_axis-40;
            else    
                y_axis = y_axis-70;
        }
        else{
            if(index%2 === 0){
                if(x_axis !== 50){
                    x_axis = x_axis-250;
                    y_axis = y_axis-50;
                }
                else
                    x_axis = x_axis+250;
            }
            else{
                if(x_axis !== 50){
                    x_axis = x_axis-250;
                    y_axis = y_axis-50;
                }
                else
                x_axis = x_axis+250;
            }
        }
        return { x_axis, y_axis };
    }

    const printPageBorder = (props) => {
        let { page } = props || {};

        page.drawLine({
            start: { x: 1, y: 3 },
            end: { x: 592, y: 3 },
            thickness: 2,
            color: rgb(0.75, 0.2, 0.2),
            opacity: 0.75,
        })

        page.drawLine({
            start: { x: 2, y: 2 },
            end: { x: 2, y: 838 },
            thickness: 2,
            color: rgb(0.75, 0.2, 0.2),
            opacity: 0.75,
        })

        page.drawLine({
            start: { x: 592, y: 2 },
            end: { x: 592, y: 838 },
            thickness: 2,
            color: rgb(0.75, 0.2, 0.2),
            opacity: 0.75,
        })

        page.drawLine({
            start: { x: 1, y: 838 },
            end: { x: 592, y: 838 },
            thickness: 2,
            color: rgb(0.75, 0.2, 0.2),
            opacity: 0.75,
        });
    }

    const printSection = (props) => {
        let { page, rgb, fieldMeta, x_axis, y_axis } = props;
        let { name, title, type } = fieldMeta || {};
        page.drawText(title, { x: x_axis, y: y_axis, size: 12, color: rgb(0, 0, 0), });
    }

    const printTextBox = (props) => {
        let { page, form, rgb, fieldMeta, x_axis, y_axis } = props;
        let x_axis2 = x_axis+100, y_axis2 = y_axis-3, height=14, width=100;
        let { name, title, type } = fieldMeta || {};
        page.drawText(title + ' :', { x: x_axis, y: y_axis, size: 10, color: rgb(0, 0, 0), });
        window[name] = form.createTextField(`member.${name}`);
        if(type === 'TEXTAREA'){
            width = 350;
            height = 34;
            x_axis2 = x_axis+100;
            y_axis2 = y_axis-23;
        }
        eval(name).addToPage(page, { x: x_axis2, y: y_axis2, width: width, height: height });

        if(type === 'MASK'){
            let maskField = form.getTextField(`member.${name}`);
            maskField.enablePassword()
        }
    }

    const printRadio = (props) => {
        let { page, form, rgb, fieldMeta, x_axis, y_axis  } = props;
        let { name, title, values = [] } = fieldMeta || {};
        window[name] = form.createRadioGroup(`member.${name}`)
        page.drawText(title + ' :', { x: x_axis, y: y_axis, size: 10, color: rgb(0, 0, 0), });
        values.map((eachVal, index )=> {
            let title = eachVal?.title || "";
            let x_axis2 = (index+1)*60+40;
            page.drawText( title, { x: x_axis+x_axis2+20, y: y_axis, size: 10 });
            eval(name).addOptionToPage(title, page, { x: x_axis+x_axis2, y: y_axis-3, width: 14, height: 14 })
        })
    }

    const printList = (props) => {
        let { page, form, rgb, fieldMeta, x_axis, y_axis  } = props;        
        let { name, title, values = [] } = fieldMeta || {};
        let options = values.map((eachVal)=> eachVal?.value);
        page.drawText(title + ' :', { x: x_axis, y: y_axis, size: 10, color: rgb(0, 0, 0), });
        window[name] = form.createDropdown(`member.${name}`);
        eval(name).addOptions(options);
        eval(name).addToPage(page, { x: x_axis+100, y: y_axis-3, height:15, width:100 });
    }

    const printCheckBox = (props) => {
        let { page, form, rgb, fieldMeta, x_axis, y_axis  } = props;
        let { name, title, values = [] } = fieldMeta || {};
        page.drawText(title + ' :', { x: x_axis, y: y_axis, size: 10, color: rgb(0, 0, 0), });
        values.map((eachVal, index )=> {
            let x_axis2 = (index+1)*60+40;
            let value = eachVal?.value || "";
            page.drawText( value, { x: x_axis+x_axis2+20, y: y_axis, size: 10 });
            window[eachVal?.id] = form.createCheckBox(`member.${name}.${eachVal.id}`);
            eval(eachVal?.id).addToPage(page, { x: x_axis+x_axis2, y: y_axis-2, width: 14, height: 14 })
        })
    }

    const createPdf = async () => {
        // Create a new PDFDocument
        const pdfDoc = await PDFDocument.create();
        const form = pdfDoc.getForm();
        let currentPage = null, x_axis = 0, y_axis = 0;
        
        compatibleTypes?.map((eachField, index, wholeData) => {
            let { type, marker = 'end' } = eachField || {};
            let previousValue = wholeData[index-1];
            if([0,21,41,61,81,101]?.includes(index)){
                currentPage = pdfDoc.addPage();
                if(index === 0)
                    currentPage.drawText('Member Form', { x: 240, y: 800, size: 20 });
                printPageBorder({ page:currentPage });
                x_axis = 50;
                y_axis = 750
            }
            switch(type){
                case 'SECTION':{
                    if(marker === 'start'){
                        if(![0,21,41,61,81,101]?.includes(index)){
                            x_axis = 50;
                            y_axis = y_axis-50;
                        }
                        printSection({ page:currentPage, form, rgb, fieldMeta:eachField, x_axis, y_axis,index });
                    }
                    break;
                }

                case 'TEXTBOX':
                case 'NUMBER':
                case 'TEXTAREA':
                case 'MASK':
                    {
                    if(![0,21,41,61,81,101]?.includes(index)){
                        if(type === 'TEXTAREA'){
                            x_axis = 50;
                            y_axis = y_axis-50;
                        }
                        else{
                            let coordinates = getCoordinates({ previousValue, x:x_axis, y:y_axis, index });
                            x_axis = coordinates?.x_axis;
                            y_axis = coordinates?.y_axis;
                        }
                    }
                    printTextBox({ page:currentPage, form, rgb, fieldMeta:eachField, x_axis, y_axis,index });
                    break;
                }
                case 'RADIO':{
                    if(![0,21,41,61,81,101]?.includes(index)){
                        if(previousValue?.type === 'TEXTAREA'){
                            x_axis = 50;
                            y_axis = y_axis-70;
                        }
                        else{
                            let coordinates = getCoordinates({previousValue, x:x_axis, y:y_axis, index });
                            x_axis = coordinates?.x_axis;
                            y_axis = coordinates?.y_axis;
                        }
                    }
                    printRadio({ page:currentPage, form, rgb, fieldMeta:eachField, x_axis, y_axis });
                    break;
                }
                case 'LIST':{
                    if(![0,21,41,61,81,101]?.includes(index)){
                        if(previousValue?.type === 'TEXTAREA'){
                            x_axis = 50;
                            y_axis = y_axis-70;
                        }
                        else{
                            let coordinates = getCoordinates({previousValue, x:x_axis, y:y_axis, index });
                            x_axis = coordinates?.x_axis;
                            y_axis = coordinates?.y_axis;
                        }
                    }
                    printList({ page:currentPage, form, rgb, fieldMeta:eachField, x_axis, y_axis });
                    break;
                }
                case 'CHECKBOX':{
                    if(![0,21,41,61,81,101]?.includes(index)){
                        if(previousValue?.type === 'TEXTAREA'){
                            x_axis = 50;
                            y_axis = y_axis-70;
                        }
                        else{
                            let coordinates = getCoordinates({previousValue, x:x_axis, y:y_axis, index });
                            x_axis = coordinates?.x_axis;
                            y_axis = coordinates?.y_axis;
                        }
                    }
                    printCheckBox({ page:currentPage, form, rgb, fieldMeta:eachField, x_axis, y_axis });
                    break;
                }
            }
        })

        // const button = form.createButton('save');
        // button.addToPage('Save', currentPage, {
        //   width: 70,
        //   height: 30,
        //   x: 480,
        //   y: 30,
        // });

        const fields = form.getFields();
        setFieldsValue(fields);

        // form.flatten();
        const pdfBytes = await pdfDoc.save()
        const bytes  = new Uint8Array( pdfBytes ); 
        const blob   = new Blob( [ bytes ], { type: "application/pdf" } );
        const docUrl = URL.createObjectURL( blob );
        setPdfData( docUrl );
    }

    const getValues = () => {
        if(fieldsValue?.length)
        fieldsValue.map((eachField)=> {
            const type = eachField.constructor.name
            const name = eachField.getName();
            console.log("eachField", eachField)
        })
    }

    useEffect(()=>{
        createPdf();
        // fillForm();
    }, []);

    useEffect(()=>{
        console.log("fieldsValue", fieldsValue)
    },[fieldsValue])
    
    return (
        <div style={{display:'flex', width:'100vw', height:'100vh', flexDirection:'column' }}>
            <div style={{display:'flex', flex:1, flexDirection:'column', textAlign:'center'}}><h1>Header</h1></div>
            <div style={{display:'flex', flex:10, flexDirection:'row'}}>
                <div style={{display:'flex', flex:2, alignItems:'center', justifyContent:'center' }}>
                    <h1>Side bar</h1>
                    <button onClick={getValues}>
                        Save
                    </button>
                </div>
                <div style={{display:'flex', flex:10}}>
                    <iframe src={pdfData} width="100%" height="100%"  title="test-frame" />
                </div>
            </div>
            
        </div>
    );
  };
  
  export default LoadPDF;
